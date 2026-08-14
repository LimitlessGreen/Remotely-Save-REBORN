import type { DropboxResponse } from "dropbox";
import { Dropbox } from "dropbox";
import { OAuth2Handler } from "../../auth/oauth2";
import {
  COMMAND_CALLBACK_DROPBOX,
  DROPBOX_APP_KEY,
  type DropboxConfig,
  type Entity,
  OAUTH2_FORCE_EXPIRE_MILLISECONDS,
} from "../../core/baseTypes";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import {
  bufferToArrayBuffer,
  delay,
  getParentFolder,
  hasEmojiInText,
  headersToRecord,
} from "../../utils/misc";

export { Dropbox } from "dropbox";

export const DEFAULT_DROPBOX_CONFIG: DropboxConfig = {
  accessToken: "",
  clientID: DROPBOX_APP_KEY ?? "",
  refreshToken: "",
  accessTokenExpiresInSeconds: 0,
  accessTokenExpiresAtTime: 0,
  accountID: "",
  username: "",
  credentialsShouldBeDeletedAtTime: 0,
};

export async function getAuthUrlAndVerifier(
  clientID: string,
  hasCallback: boolean
) {
  const { verifier, challenge } = await OAuth2Handler.generatePkce();
  const oauth = new OAuth2Handler({
    clientId: clientID,
    authEndpoint: "https://www.dropbox.com/oauth2/authorize",
    tokenEndpoint: "https://api.dropbox.com/oauth2/token",
    redirectUri: hasCallback
      ? `obsidian://${COMMAND_CALLBACK_DROPBOX}`
      : "http://localhost",
    scopes: [],
  });
  const authUrl = oauth.getAuthUrl("state", {
    code_challenge: challenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
  });
  return { authUrl, verifier };
}

export async function sendAuthReq(
  clientID: string,
  verifier: string,
  code: string,
  errorCallback?: (err: unknown) => void
) {
  try {
    const oauth = new OAuth2Handler({
      clientId: clientID,
      authEndpoint: "https://www.dropbox.com/oauth2/authorize",
      tokenEndpoint: "https://api.dropbox.com/oauth2/token",
      redirectUri: `obsidian://${COMMAND_CALLBACK_DROPBOX}`,
      scopes: [],
    });
    return await oauth.exchangeCode(code, verifier);
  } catch (e) {
    if (errorCallback) {
      errorCallback(e);
    } else {
      throw e;
    }
  }
}

export const setConfigBySuccessfullAuthInplace = async (
  config: DropboxConfig,
  authRes: { access_token: string; refresh_token?: string; expires_in: number },
  saveUpdatedConfigFunc: () => Promise<void>
) => {
  config.accessToken = authRes.access_token;
  config.refreshToken = authRes.refresh_token || config.refreshToken;
  config.accessTokenExpiresInSeconds = authRes.expires_in;
  config.accessTokenExpiresAtTime =
    Date.now() + authRes.expires_in * 1000 - 10000;
  config.credentialsShouldBeDeletedAtTime =
    Date.now() + OAUTH2_FORCE_EXPIRE_MILLISECONDS;
  await saveUpdatedConfigFunc();
};

/**
 * Dropbox-specific case sensitivity fix.
 */
export const fixEntityListCasesInplace = (entities: Entity[]) => {
  entities.sort((a, b) => (a.key || "").length - (b.key || "").length);
  const caseMapping: Record<string, string> = { "": "" };
  for (const e of entities) {
    let parentFolder = getParentFolder(e.key || "");
    if (parentFolder === "/") parentFolder = "";
    const parentFolderLower = parentFolder.toLocaleLowerCase();
    const segs = (e.key || "").split("/");
    if ((e.key || "").endsWith("/")) {
      if (caseMapping.hasOwnProperty(parentFolderLower)) {
        const newKey = `${caseMapping[parentFolderLower]}${segs.slice(-2).join("/")}`;
        caseMapping[newKey.toLocaleLowerCase()] = newKey;
        e.key = newKey;
      }
    } else {
      if (caseMapping.hasOwnProperty(parentFolderLower)) {
        const newKey = `${caseMapping[parentFolderLower]}${segs.slice(-1).join("/")}`;
        e.key = newKey;
      }
    }
  }
  return entities;
};

async function retryReq<T>(
  reqFunc: () => Promise<DropboxResponse<T>>,
  _extraHint = ""
): Promise<DropboxResponse<T>> {
  const waitSeconds = [1, 2, 4, 8];
  for (let idx = 0; idx < waitSeconds.length; ++idx) {
    try {
      return await reqFunc();
    } catch (e: unknown) {
      const err = e as { status: number; error: any; headers: any };
      console.error(
        `Dropbox Error: status=${err.status}, body=${JSON.stringify(err.error)}`
      );
      const isNetworkErr = err.status === undefined && e instanceof TypeError;
      const isWriteContention =
        err.status === 409 &&
        JSON.stringify(err.error ?? "").includes("too_many_write_operations");
      if (!isNetworkErr && err.status !== 429 && !isWriteContention) throw e;
      if (idx === waitSeconds.length - 1) throw e;

      const headers = isNetworkErr ? {} : headersToRecord(err.headers);
      const svrSec =
        e.error?.error?.retry_after ||
        Number.parseInt(headers["retry-after"] || "1", 10) ||
        1;
      const secMin = Math.max(svrSec, waitSeconds[idx]);
      await delay(
        Math.floor(Math.random() * (secMin * 0.8 * 1000 + 1)) + secMin * 1000
      );
    }
  }
  throw Error("Retry failed");
}

export class RawDropboxFs implements RawFs {
  private dropbox!: Dropbox;
  private foldersCreatedBefore: Set<string> = new Set();

  constructor(
    private config: DropboxConfig,
    private saveUpdatedConfigFunc: () => Promise<void>
  ) {}

  private fixPathForApi(p: string): string {
    let res = p.replace(/\/$/, "");
    if (res === "") return ""; // Root for list_folder
    if (!res.startsWith("/")) res = "/" + res;
    return res;
  }

  private fixPathFromApi(p: string): string {
    if (p.startsWith("/")) return p.slice(1);
    return p;
  }

  private async ensureInited() {
    if (this.dropbox) return;
    const currentTs = Date.now();
    if (this.config.accessTokenExpiresAtTime <= currentTs) {
      const resp = await this.refreshAccessToken();
      await this.updateConfig(resp);
    }
    this.dropbox = new Dropbox({
      accessToken: this.config.accessToken,
      customHeaders: { "Cache-Control": "no-cache" },
    });
  }

  private async refreshAccessToken() {
    const resp1 = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientID,
      }),
    });
    return await resp1.json();
  }

  private async updateConfig(authRes: {
    access_token: string;
    expires_in: number;
  }) {
    this.config.accessToken = authRes.access_token;
    this.config.accessTokenExpiresAtTime =
      Date.now() + authRes.expires_in * 1000 - 10000;
    await this.saveUpdatedConfigFunc();
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
    const apiPath = this.fixPathForApi(fullPath);
    let res = await this.dropbox.filesListFolder({
      path: apiPath,
      recursive: !partial,
      limit: partial ? 10 : 1000,
    });

    const contents: Entity[] = [];
    const processEntries = (entries: any[]) => {
      for (const x of entries) {
        if (x[".tag"] === "deleted") continue;
        let key = this.fixPathFromApi(x.path_display || x.path_lower || "");
        if (x[".tag"] === "folder" && !key.endsWith("/")) key += "/";
        const entity: Entity = {
          key,
          keyRaw: key,
          size: x.size || 0,
          sizeRaw: x.size || 0,
          mtimeCli: x.client_modified
            ? Date.parse(x.client_modified).valueOf()
            : undefined,
          mtimeSvr: x.server_modified
            ? Date.parse(x.server_modified).valueOf()
            : undefined,
          hash: x.content_hash,
          versionId: (x as any).rev,
        };
        contents.push(entity);
      }
    };

    processEntries(res.result.entries);
    if (!partial) {
      while (res.result.has_more) {
        res = await this.dropbox.filesListFolderContinue({
          cursor: res.result.cursor,
        });
        processEntries(res.result.entries);
      }
    }

    fixEntityListCasesInplace(contents);
    return contents;
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const apiPath = this.fixPathForApi(fullPath);
    const rsp = await retryReq(() =>
      this.dropbox.filesGetMetadata({ path: apiPath })
    );
    const x = rsp.result as any;
    let key = this.fixPathFromApi(x.path_display || x.path_lower || "");
    if (x[".tag"] === "folder" && !key.endsWith("/")) key += "/";
    return {
      key,
      keyRaw: key,
      size: x.size || 0,
      sizeRaw: x.size || 0,
      mtimeCli: x.client_modified
        ? Date.parse(x.client_modified).valueOf()
        : undefined,
      mtimeSvr: x.server_modified
        ? Date.parse(x.server_modified).valueOf()
        : undefined,
      hash: x.content_hash,
      versionId: x.rev,
    };
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const apiPath = this.fixPathForApi(fullPath);
    if (hasEmojiInText(apiPath)) throw Error("Dropbox no emoji in folders");
    if (!this.foldersCreatedBefore.has(apiPath)) {
      try {
        await retryReq(() =>
          this.dropbox.filesCreateFolderV2({ path: apiPath })
        );
      } catch (e: any) {
        if (e.status !== 409) throw e;
      }
      this.foldersCreatedBefore.add(apiPath);
    }
    return await this.stat(fullPath);
  }

  async writeFile(
    fullPath: string,
    content: ArrayBuffer,
    mtime: number,
    _ctime: number
  ): Promise<Entity> {
    await this.ensureInited();
    const apiPath = this.fixPathForApi(fullPath);
    const mtimeStr = new Date(Math.floor(mtime / 1000.0) * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z");
    await retryReq(() =>
      this.dropbox.filesUpload({
        path: apiPath,
        contents: content,
        mode: { ".tag": "overwrite" },
        client_modified: mtimeStr,
      })
    );
    return await this.stat(fullPath);
  }

  async readFile(fullPath: string, versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    const apiPath = versionId
      ? `rev:${versionId}`
      : this.fixPathForApi(fullPath);
    const rsp = await retryReq(() =>
      this.dropbox.filesDownload({ path: apiPath })
    );
    const result = rsp.result as any;
    if (result.fileBlob) return await result.fileBlob.arrayBuffer();
    if (result.fileBinary) return bufferToArrayBuffer(result.fileBinary);
    throw Error("Unknown download result");
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    const apiPath = this.fixPathForApi(fullPath);
    try {
      await retryReq(() => this.dropbox.filesDeleteV2({ path: apiPath }));
    } catch (e: any) {
      if (!JSON.stringify(e).includes("not_found")) throw e;
    }
  }

  async listVersions(fullPath: string): Promise<Entity[]> {
    await this.ensureInited();
    const apiPath = this.fixPathForApi(fullPath);
    const res = await retryReq(() =>
      this.dropbox.filesListRevisions({ path: apiPath, limit: 100 })
    );
    return res.result.entries.map((x) => {
      let key = this.fixPathFromApi(x.path_display || x.path_lower || fullPath);
      if (!key.endsWith("/") && fullPath.endsWith("/")) key += "/";
      return {
        key,
        keyRaw: key,
        size: (x as any).size || 0,
        sizeRaw: (x as any).size || 0,
        mtimeCli: (x as any).client_modified
          ? Date.parse((x as any).client_modified).valueOf()
          : undefined,
        mtimeSvr: (x as any).server_modified
          ? Date.parse((x as any).server_modified).valueOf()
          : undefined,
        hash: (x as any).content_hash,
        versionId: (x as any).rev,
        isLatest: false,
      };
    });
  }

  async rename(fullPath1: string, fullPath2: string): Promise<void> {
    await this.ensureInited();
    const apiPath1 = this.fixPathForApi(fullPath1);
    const apiPath2 = this.fixPathForApi(fullPath2);
    await retryReq(() =>
      this.dropbox.filesMoveV2({ from_path: apiPath1, to_path: apiPath2 })
    );
  }

  async checkConnect(fullPath: string): Promise<boolean> {
    await this.ensureInited();
    const apiPath = this.fixPathForApi(fullPath);
    await this.dropbox.filesListFolder({ path: apiPath, limit: 1 });
    return true;
  }
}

export class DropboxFileSystem extends BaseCloudFs {
  constructor(
    config: DropboxConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<any>
  ) {
    super(
      "dropbox",
      new RawDropboxFs(config, saveUpdatedConfigFunc),
      config.remoteBaseDir || vaultName
    );
  }

  async checkConnect(callbackFunc?: (err?: unknown) => void): Promise<boolean> {
    try {
      await (this.rawFs as RawDropboxFs).checkConnect(this.toFullPath(""));
    } catch (err: unknown) {
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
