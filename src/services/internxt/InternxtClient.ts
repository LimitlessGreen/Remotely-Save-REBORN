import {
  DecryptFileName,
  EncryptFilename,
  GenerateFileKey,
} from "@internxt/inxt-js/build/lib/utils/crypto/crypto";
import {
  Auth,
  type CryptoProvider,
  Drive,
  type Keys,
  type Password,
} from "@internxt/sdk";
import { Network } from "@internxt/sdk/dist/network";
import * as crypto from "crypto";
import CryptoJS from "crypto-js";
import { requestUrl } from "obsidian";

/**
 * Custom Internxt Crypto Provider
 */
class InternxtCryptoProvider implements CryptoProvider {
  private readonly PEPPER = "6KYQBP847D4ATSFA";

  encryptPasswordHash(password: Password, encryptedSalt: string): string {
    try {
      const rawSaltHex = this.decryptSaltSync(encryptedSalt);
      const rawSalt = CryptoJS.enc.Hex.parse(rawSaltHex);

      const hash = CryptoJS.PBKDF2(password, rawSalt, {
        keySize: 256 / 32,
        iterations: 10000,
        hasher: CryptoJS.algo.SHA1,
      }).toString();

      const encrypted = CryptoJS.AES.encrypt(hash, this.PEPPER).toString();
      const hex = CryptoJS.enc.Hex.stringify(
        CryptoJS.enc.Base64.parse(encrypted)
      );
      return hex;
    } catch (e) {
      console.error("Encryption failed:", e);
      return "";
    }
  }

  private decryptSaltSync(encryptedSalt: string): string {
    const reb64 = CryptoJS.enc.Hex.parse(encryptedSalt);
    const bytes = reb64.toString(CryptoJS.enc.Base64);
    const decrypt = CryptoJS.AES.decrypt(bytes, this.PEPPER);
    return decrypt.toString(CryptoJS.enc.Utf8);
  }

  async generateKeys(_password: Password): Promise<Keys> {
    return {
      ecc: { publicKey: "", privateKeyEncrypted: "" },
      kyber: { publicKey: "", privateKeyEncrypted: "" },
    };
  }
}

export class InternxtClient {
  private auth: Auth;
  private storage?: Drive.Storage;
  private network?: Network;
  private cryptoProvider: InternxtCryptoProvider;
  private config?: {
    token: string;
    mnemonic: string;
    bridgeUser: string;
    userId: string;
    rootFolderUuid: string;
    bucketId: string;
  };
  private clientName: string;
  private clientVersion: string;
  private apiUrl = "https://gateway.internxt.com/drive";
  private networkUrl = "https://gateway.internxt.com/network";

  constructor(
    config?: {
      token: string;
      mnemonic: string;
      bridgeUser: string;
      userId: string;
      rootFolderUuid: string;
      bucketId: string;
    },
    appDetails: { clientName: string; clientVersion: string } = {
      clientName: "remotely-save",
      clientVersion: "1.0.0",
    }
  ) {
    this.clientName = appDetails.clientName;
    this.clientVersion = appDetails.clientVersion;
    this.cryptoProvider = new InternxtCryptoProvider();
    const sdkAppDetails = {
      clientName: this.clientName,
      clientVersion: this.clientVersion,
    };

    this.auth = Auth.client(this.apiUrl, sdkAppDetails);

    if (config) {
      this.config = config;
      this.storage = Drive.Storage.client(this.apiUrl, sdkAppDetails, {
        token: config.token,
      });
      this.network = Network.client(this.networkUrl, sdkAppDetails, {
        bridgeUser: config.bridgeUser,
        userId: crypto.createHash("sha256").update(config.userId).digest("hex"),
      });
    }
  }

  private async retryReq<T>(reqFunc: () => Promise<T>): Promise<T> {
    const waitSeconds = [1, 2, 4, 8];
    for (let idx = 0; idx < waitSeconds.length; ++idx) {
      try {
        return await reqFunc();
      } catch (e: any) {
        const status = e.response?.status || e.status;
        const isNetworkErr = !status && e instanceof TypeError;
        const isRetryable =
          isNetworkErr ||
          status === 429 ||
          status === 503 ||
          status === 502 ||
          status === 500;

        if (!isRetryable || idx === waitSeconds.length - 1) throw e;

        const wait = waitSeconds[idx] * 1000 + Math.random() * 1000;
        console.warn(
          `Internxt retry ${idx + 1} after ${Math.round(wait)}ms due to status ${status || "network error"}`
        );
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
    throw new Error("Retry failed");
  }

  async login(
    email: string,
    password: string
  ): Promise<{ token: string; mnemonic: string; user: any }> {
    const res = await this.auth.loginWithoutKeys(
      {
        email: email.toLowerCase(),
        password,
        tfaCode: undefined,
      },
      this.cryptoProvider
    );

    const encryptedMnemonic = res.user.mnemonic;
    const decryptedMnemonic = this.decryptMnemonic(encryptedMnemonic, password);

    return {
      token: res.newToken,
      mnemonic: decryptedMnemonic,
      user: res.user,
    };
  }

  private decryptMnemonic(encrypted: string, password: string): string {
    const reb64 = CryptoJS.enc.Hex.parse(encrypted);
    const bytes = reb64.toString(CryptoJS.enc.Base64);
    const decrypt = CryptoJS.AES.decrypt(bytes, password);
    return decrypt.toString(CryptoJS.enc.Utf8);
  }

  async getFolderContents(folderUuid: string): Promise<any> {
    if (!this.storage) throw new Error("Not authenticated");
    return this.retryReq(async () => {
      if (!this.storage) throw new Error("Storage not initialized");
      const [promise] = this.storage.getFolderContentByUuid({ folderUuid });
      return await promise;
    });
  }

  async getFolderMeta(folderUuid: string): Promise<any> {
    if (!this.storage) throw new Error("Not authenticated");
    return this.retryReq(async () => {
      return await this.storage?.getFolderMeta(folderUuid);
    });
  }

  async createFolder(parentFolderUuid: string, name: string): Promise<any> {
    if (!this.storage) throw new Error("Not authenticated");
    return this.retryReq(async () => {
      try {
        const encryptedName = await EncryptFilename(
          this.config?.mnemonic,
          this.config?.bucketId,
          name
        );
        if (!this.storage) throw new Error("Storage not initialized");
        const [promise] = this.storage.createFolderByUuid({
          plainName: name,
          name: encryptedName,
          parentFolderUuid,
        } as any);
        return await promise;
      } catch (e: unknown) {
        if (e.status === 409 || e.status === 422) {
          const contents = await this.getFolderContents(parentFolderUuid);
          const existing = contents.children?.find(
            (c: any) => (c.plainName || c.name) === name
          );
          if (existing) return existing;
        }
        throw e;
      }
    });
  }

  async deleteFile(fileUuid: string): Promise<void> {
    if (!this.storage) throw new Error("Not authenticated");
    await this.retryReq(async () => {
      try {
        await this.storage?.deleteFileByUuid(fileUuid);
      } catch (e: any) {
        if (e.status !== 404) throw e;
      }
    });
  }

  async deleteFolder(folderUuid: string): Promise<void> {
    if (!this.storage) throw new Error("Not authenticated");
    await this.retryReq(async () => {
      try {
        await this.storage?.deleteFolderByUuid(folderUuid);
      } catch (e: any) {
        if (e.status !== 404) throw e;
      }
    });
  }

  async getFileMeta(fileUuid: string): Promise<any> {
    if (!this.storage) throw new Error("Not authenticated");
    return this.retryReq(async () => {
      if (!this.storage) throw new Error("Storage not initialized");
      const [promise] = this.storage.getFile(fileUuid);
      return await promise;
    });
  }

  async uploadFile(
    parentFolderUuid: string,
    filename: string,
    content: Buffer,
    size: number,
    mtime?: number,
    ctime?: number
  ): Promise<any> {
    if (!this.network || !this.config || !this.storage)
      throw new Error("Not authenticated");

    const bucketId = this.config.bucketId;
    let networkFileId: string | undefined;
    let uploadSize = size;
    let uploadContent = content;

    if (size === 0) {
      // Workaround: Internxt network doesn't support 0-byte files.
      // Use a single space (1 byte) instead.
      uploadSize = 1;
      uploadContent = Buffer.from(" ");
    }

    // 1. Start upload
    const { uploads } = await this.network.startUpload(bucketId, uploadSize);
    const [{ url, uuid }] = uploads;

    // 2. Encrypt file
    const index = crypto.randomBytes(32);
    const iv = index.slice(0, 16);
    const key = await GenerateFileKey(this.config.mnemonic, bucketId, index);

    const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
    const encryptedContent = Buffer.concat([
      cipher.update(uploadContent),
      cipher.final(),
    ]);

    // 3. Calculate hash (SHA256 then RIPEMD160)
    const sha256Hash = crypto
      .createHash("sha256")
      .update(encryptedContent)
      .digest();
    const ripemd160Hash = crypto
      .createHash("ripemd160")
      .update(sha256Hash)
      .digest("hex");

    // 4. PUT to network using Obsidian requestUrl
    // Ensure we send a clean ArrayBuffer copy to avoid ERR_INVALID_ARGUMENT
    const body = new Uint8Array(encryptedContent).slice().buffer;

    try {
      const putRes = await requestUrl({
        url: url!,
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: body,
      });
      if (putRes.status !== 200 && putRes.status !== 201) {
        throw new Error(
          `Internxt network PUT failed with status ${putRes.status}`
        );
      }
    } catch (e: any) {
      console.error("[INTERNXT] requestUrl PUT failed:", e);
      throw e;
    }

    // 5. Finish upload
    const finishPayload = {
      index: index.toString("hex"),
      shards: [{ hash: ripemd160Hash, uuid }],
    };

    try {
      const finishRes: any = await this.network.finishUpload(
        bucketId,
        finishPayload
      );
      networkFileId = typeof finishRes === "string" ? finishRes : finishRes.id;
    } catch (e: any) {
      if (e.response?.data) {
        console.error(
          "[INTERNXT] Finish upload failed:",
          JSON.stringify(e.response.data)
        );
      }
      throw e;
    }

    // 6. Create Drive entry
    const dotIdx = filename.lastIndexOf(".");
    const nameOnly = dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
    const extension = dotIdx > 0 ? filename.substring(dotIdx + 1) : "";

    // Encrypt the same string as plainName for consistency with official clients
    const encryptedName = await EncryptFilename(
      this.config.mnemonic,
      bucketId,
      nameOnly
    );

    const payload = {
      bucket: bucketId,
      fileId: networkFileId,
      encryptVersion: "03-aes" as any,
      folderUuid: parentFolderUuid,
      size: uploadSize,
      plainName: nameOnly,
      name: encryptedName,
      type: extension,
      modificationTime: mtime ? new Date(mtime).toISOString() : undefined,
      creationTime: ctime ? new Date(ctime).toISOString() : undefined,
    };

    return this.retryReq(async () => {
      return await this.storage?.createFileEntryByUuid(payload as any);
    });
  }

  async downloadFile(fileUuid: string): Promise<Buffer> {
    if (!this.network || !this.config || !this.storage)
      throw new Error("Not authenticated");

    const fileMeta = await this.getFileMeta(fileUuid);
    const bucketId = fileMeta.bucket;
    const fileId = fileMeta.fileId;

    // 1. Get download links
    const downloads: any = await this.network.getDownloadLinks(
      bucketId,
      fileId
    );
    const [{ url, hash: expectedHash }] = downloads.shards;
    const indexHex = downloads.index;

    // 2. Download encrypted content using Obsidian requestUrl
    const res = await requestUrl({
      url: url,
      method: "GET",
    });
    const encryptedContent = Buffer.from(res.arrayBuffer);

    // 3. Verify hash
    const sha256Hash = crypto
      .createHash("sha256")
      .update(encryptedContent)
      .digest();
    const actualHash = crypto
      .createHash("ripemd160")
      .update(sha256Hash)
      .digest("hex");
    if (actualHash !== expectedHash) {
      throw new Error("Hash mismatch during download");
    }

    // 4. Decrypt file
    if (!indexHex) throw new Error("No index found for decryption");
    const index = Buffer.from(indexHex, "hex");
    const iv = index.slice(0, 16);
    const key = await GenerateFileKey(this.config.mnemonic, bucketId, index);

    const decipher = crypto.createDecipheriv("aes-256-ctr", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encryptedContent),
      decipher.final(),
    ]);

    return decrypted;
  }

  async decryptFilename(
    encryptedName: string,
    bucketId: string
  ): Promise<string> {
    if (!this.config) throw new Error("Not authenticated");
    try {
      const decrypted = await DecryptFileName(
        this.config.mnemonic,
        bucketId,
        encryptedName
      );
      return decrypted || encryptedName;
    } catch (_e) {
      return encryptedName;
    }
  }
}
