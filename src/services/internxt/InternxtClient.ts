import { Auth, Drive, CryptoProvider, Keys, Password } from '@internxt/sdk';
import { Environment } from '@internxt/inxt-js';
import { EncryptFilename, DecryptFileName } from '@internxt/inxt-js/build/lib/utils/crypto/crypto';
import CryptoJS from 'crypto-js';
import { Readable } from 'stream';

/**
 * Custom Internxt Crypto Provider
 */
class InternxtCryptoProvider implements CryptoProvider {
  private readonly PEPPER = '6KYQBP847D4ATSFA';

  encryptPasswordHash(password: Password, encryptedSalt: string): string {
    try {
      const rawSaltHex = this.decryptSaltSync(encryptedSalt);
      const rawSalt = CryptoJS.enc.Hex.parse(rawSaltHex);

      const hash = CryptoJS.PBKDF2(password, rawSalt, {
        keySize: 256 / 32,
        iterations: 10000,
        hasher: CryptoJS.algo.SHA1
      }).toString();

      const encrypted = CryptoJS.AES.encrypt(hash, this.PEPPER).toString();
      const hex = CryptoJS.enc.Hex.stringify(CryptoJS.enc.Base64.parse(encrypted));
      return hex;
    } catch (e) {
      console.error('Encryption failed:', e);
      return '';
    }
  }

  private decryptSaltSync(encryptedSalt: string): string {
    const reb64 = CryptoJS.enc.Hex.parse(encryptedSalt);
    const bytes = reb64.toString(CryptoJS.enc.Base64);
    const decrypt = CryptoJS.AES.decrypt(bytes, this.PEPPER);
    return decrypt.toString(CryptoJS.enc.Utf8);
  }

  async generateKeys(password: Password): Promise<Keys> {
    return {
      ecc: { publicKey: '', privateKeyEncrypted: '' },
      kyber: { publicKey: '', privateKeyEncrypted: '' }
    };
  }
}

export class InternxtClient {
  private auth: Auth;
  private storage?: Drive.Storage;
  private network?: Environment;
  private cryptoProvider: InternxtCryptoProvider;
  private config?: { token: string; mnemonic: string; bridgeUser: string; userId: string; rootFolderUuid: string; bucketId: string };
  private clientName: string;
  private clientVersion: string;

  private readonly BASE_URL = 'https://gateway.internxt.com/drive';

  constructor(
    config?: { token: string; mnemonic: string; bridgeUser: string; userId: string; rootFolderUuid: string; bucketId: string },
    appDetails: { clientName: string; clientVersion: string } = { clientName: 'remotely-save', clientVersion: '1.0.0' }
  ) {
    this.clientName = appDetails.clientName;
    this.clientVersion = appDetails.clientVersion;
    this.cryptoProvider = new InternxtCryptoProvider();
    const apiUrl = 'https://gateway.internxt.com/drive';
    const networkUrl = 'https://gateway.internxt.com/network';
    const sdkAppDetails = {
      clientName: this.clientName,
      clientVersion: this.clientVersion
    };

    this.auth = Auth.client(apiUrl, sdkAppDetails);

    if (config) {
      this.config = config;
      this.storage = Drive.Storage.client(apiUrl, sdkAppDetails, {
        token: config.token,
      });
      this.network = new Environment({
        bridgeUrl: networkUrl,
        bridgeUser: config.bridgeUser,
        bridgePass: config.userId,
        encryptionKey: config.mnemonic,
        appDetails: sdkAppDetails
      });
    }
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.config?.token}`,
      'Content-Type': 'application/json',
      'internxt-client': this.clientName,
      'internxt-version': this.clientVersion
    };
  }

  private async retryReq<T>(reqFunc: () => Promise<T>): Promise<T> {
    const waitSeconds = [1, 2, 4, 8];
    for (let idx = 0; idx < waitSeconds.length; ++idx) {
      try {
        return await reqFunc();
      } catch (e: any) {
        const status = e.response?.status || e.status;
        const isNetworkErr = !status && e instanceof TypeError;
        const isRetryable = isNetworkErr || status === 429 || status === 503 || status === 502 || status === 500;

        if (!isRetryable || idx === waitSeconds.length - 1) throw e;

        const wait = waitSeconds[idx] * 1000 + Math.random() * 1000;
        console.warn(`Internxt retry ${idx + 1} after ${Math.round(wait)}ms due to status ${status || 'network error'}`);
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
    throw new Error('Retry failed');
  }

  async login(email: string, password: string): Promise<{ token: string; mnemonic: string; user: any }> {
    const res = await this.auth.loginWithoutKeys({
      email: email.toLowerCase(),
      password,
      tfaCode: undefined
    }, this.cryptoProvider);

    const encryptedMnemonic = res.user.mnemonic;
    const decryptedMnemonic = this.decryptMnemonic(encryptedMnemonic, password);

    return {
      token: res.newToken,
      mnemonic: decryptedMnemonic,
      user: res.user
    };
  }

  private decryptMnemonic(encrypted: string, password: string): string {
    const reb64 = CryptoJS.enc.Hex.parse(encrypted);
    const bytes = reb64.toString(CryptoJS.enc.Base64);
    const decrypt = CryptoJS.AES.decrypt(bytes, password);
    return decrypt.toString(CryptoJS.enc.Utf8);
  }

  async getFolderContents(folderUuid: string): Promise<any> {
    return this.retryReq(async () => {
      const resp = await fetch(`${this.BASE_URL}/folders/content/${folderUuid}`, {
        headers: this.headers
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Get folder contents failed (${resp.status}): ${text}`);
      }
      return await resp.json();
    });
  }

  async getFolderMeta(folderUuid: string): Promise<any> {
    return this.retryReq(async () => {
      const resp = await fetch(`${this.BASE_URL}/folders/${folderUuid}/meta`, {
        headers: this.headers
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Get folder meta failed (${resp.status}): ${text}`);
      }
      return await resp.json();
    });
  }

  async createFolder(parentFolderUuid: string, name: string): Promise<any> {
    if (!this.config) throw new Error('Not authenticated');
    return this.retryReq(async () => {
      const resp = await fetch(`${this.BASE_URL}/folders`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          plainName: name,
          parentFolderUuid
        })
      });

      if (!resp.ok) {
        if (resp.status === 409 || resp.status === 422) {
          const contents = await this.getFolderContents(parentFolderUuid);
          const existing = contents.children?.find((c: any) => (c.plainName || c.name) === name);
          if (existing) return existing;
        }
        const text = await resp.text();
        throw new Error(`Create folder failed (${resp.status}): ${text}`);
      }
      return await resp.json();
    });
  }

  async deleteFile(fileUuid: string): Promise<void> {
    await this.retryReq(async () => {
      const resp = await fetch(`${this.BASE_URL}/files/${fileUuid}`, {
        method: 'DELETE',
        headers: this.headers
      });
      if (!resp.ok && resp.status !== 404) {
        const text = await resp.text();
        throw new Error(`Delete file failed (${resp.status}): ${text}`);
      }
    });
  }

  async deleteFolder(folderUuid: string): Promise<void> {
    await this.retryReq(async () => {
      const resp = await fetch(`${this.BASE_URL}/folders/${folderUuid}`, {
        method: 'DELETE',
        headers: this.headers
      });
      if (!resp.ok && resp.status !== 404) {
        const text = await resp.text();
        throw new Error(`Delete folder failed (${resp.status}): ${text}`);
      }
    });
  }

  async getFileMeta(fileUuid: string): Promise<any> {
    return this.retryReq(async () => {
      const resp = await fetch(`${this.BASE_URL}/files/${fileUuid}/meta`, {
        headers: this.headers
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Get file meta failed (${resp.status}): ${text}`);
      }
      return await resp.json();
    });
  }

  async uploadFile(parentFolderUuid: string, filename: string, content: Buffer, size: number, mtime?: number, ctime?: number): Promise<any> {
    if (!this.network || !this.config) throw new Error('Not authenticated');

    const bucketId = this.config.bucketId;
    const source = Readable.from(content);
    const networkFileId = await this.network.upload(bucketId, {
      source,
      fileSize: size,
      progressCallback: () => { }
    });

    const extension = filename.split('.').pop() || '';
    const payload = {
      bucket: bucketId,
      fileId: networkFileId,
      encryptVersion: '03-aes',
      folderUuid: parentFolderUuid,
      size: size,
      plainName: filename,
      type: extension,
      modificationTime: mtime ? new Date(mtime).toISOString() : undefined,
      creationTime: ctime ? new Date(ctime).toISOString() : undefined
    };

    return this.retryReq(async () => {
      const resp = await fetch(`${this.BASE_URL}/files`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Create file entry failed (${resp.status}): ${text}`);
      }
      return await resp.json();
    });
  }

  async downloadFile(fileUuid: string): Promise<Buffer> {
    if (!this.network || !this.config) throw new Error('Not authenticated');

    const fileMeta = await this.getFileMeta(fileUuid);

    const bucketId = fileMeta.bucket;
    const bridgeFileId = fileMeta.fileId;
    if (!bridgeFileId) throw new Error('File not found on network');

    return new Promise((resolve, reject) => {
      const opts = {
        progressCallback: () => { },
        finishedCallback: (err: Error | null, stream: Readable | null) => {
          if (err) return reject(err);
          if (!stream) return reject(new Error('No stream returned'));

          const chunks: Buffer[] = [];
          stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', (err) => reject(err));
        }
      };

      const strategy = {
        label: 'Dynamic',
        params: {
          chunkSize: 1024 * 1024
        }
      };

      this.network!.download(bucketId, bridgeFileId, opts as any, strategy as any);
    });
  }

  async decryptFilename(encryptedName: string, bucketId: string): Promise<string> {
    if (!this.config) throw new Error('Not authenticated');
    try {
      const decrypted = await DecryptFileName(this.config.mnemonic, bucketId, encryptedName);
      return decrypted || encryptedName;
    } catch (e) {
      return encryptedName;
    }
  }
}
