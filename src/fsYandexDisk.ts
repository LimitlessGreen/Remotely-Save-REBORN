import { nanoid } from "nanoid";
import PQueue from "p-queue";
import {
  type Entity,
  YANDEXDISK_CLIENT_ID,
  YANDEXDISK_CLIENT_SECRET,
  type YandexDiskConfig,
  COMMAND_CALLBACK_YANDEXDISK,
} from "./baseTypes";
import { FakeFs } from "./fsAll";
import { YandexApi } from "./yandexApi";

export const DEFAULT_YANDEXDISK_CONFIG: YandexDiskConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  scope: "",
  kind: "yandexdisk",
};

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Yandex Disk storage service
 */

export const generateAuthUrl = (hasCallback: boolean) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: YANDEXDISK_CLIENT_ID ?? "",
    force_confirm: "yes",
    state: nanoid(),
  });
  if (hasCallback) params.set("redirect_uri", `obsidian://${COMMAND_CALLBACK_YANDEXDISK}`);
  return `https://oauth.yandex.com/authorize?${params}`;
};

export const sendAuthReq = async (authCode: string, errorCallBack: any) => {
  try {
    const params = new URLSearchParams({
      code: authCode,
      grant_type: "authorization_code",
      client_id: YANDEXDISK_CLIENT_ID ?? "",
      client_secret: YANDEXDISK_CLIENT_SECRET ?? "",
    });
    const resp = await fetch(`https://oauth.yandex.com/token`, {
      method: "POST",
      body: params,
    });
    return await resp.json();
  } catch (e) {
    console.error(e);
    if (errorCallBack) await errorCallBack(e);
  }
};

export const sendRefreshTokenReq = async (refreshToken: string) => {
  const params = new URLSearchParams({
    client_id: YANDEXDISK_CLIENT_ID ?? "",
    client_secret: YANDEXDISK_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth.yandex.com/token", {
    method: "POST",
    body: params,
  });
  return await res.json();
};

export class FakeFsYandexDisk extends FakeFs {
  kind: "yandexdisk" = "yandexdisk";
  config: YandexDiskConfig;
  remoteBaseDir: string;
  saveUpdatedConfigFunc: () => Promise<any>;
  api: YandexApi;

  constructor(
    config: YandexDiskConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<any>
  ) {
    super();
    this.config = config;
    this.remoteBaseDir = config.remoteBaseDir || vaultName;
    this.saveUpdatedConfigFunc = saveUpdatedConfigFunc;
    this.api = new YandexApi(this.config.accessToken);
  }

  async _init() {
    if (Date.now() > this.config.accessTokenExpiresAtTimeMs) {
        const res = await sendRefreshTokenReq(this.config.refreshToken);
        this.config.accessToken = res.access_token;
        this.config.accessTokenExpiresInMs = res.expires_in * 1000;
        this.config.accessTokenExpiresAtTimeMs = Date.now() + res.expires_in * 1000 - 60 * 5 * 1000;
        await this.saveUpdatedConfigFunc();
        this.api = new YandexApi(this.config.accessToken);
    }

    // Ensure vault folder exists
    try {
        await this.api.getResource(this.remoteBaseDir);
    } catch (e) {
        await this.api.mkdir(this.remoteBaseDir);
    }
  }

  async walk(): Promise<Entity[]> {
    await this._init();
    const allFiles: Entity[] = [];
    const walkInternal = async (path: string) => {
        const res = await this.api.getResource(path);
        for (const item of res._embedded?.items || []) {
            const isFolder = item.type === "dir";
            const keyRaw = (path === this.remoteBaseDir ? "" : path.replace(this.remoteBaseDir + "/", "")) + "/" + item.name + (isFolder ? "/" : "");
            const entity: Entity = {
                keyRaw,
                key: keyRaw,
                sizeRaw: item.size || 0,
                mtimeSvr: Date.parse(item.modified!).valueOf(),
            };
            allFiles.push(entity);
            if (isFolder) await walkInternal(item.path!.replace("disk:", ""));
        }
    };
    await walkInternal(this.remoteBaseDir);
    return allFiles;
  }

  async readFile(key: string): Promise<ArrayBuffer> {
    await this._init();
    const link = await this.api.getDownloadLink(`${this.remoteBaseDir}/${key}`);
    const res = await fetch(link.href);
    return await res.arrayBuffer();
  }

  async writeFile(key: string, content: ArrayBuffer, mtime: number, ctime: number): Promise<Entity> {
    await this._init();
    const link = await this.api.getUploadLink(`${this.remoteBaseDir}/${key}`, true);
    await fetch(link.href, { method: "PUT", body: content });
    return this.stat(key);
  }

  async rm(key: string): Promise<void> {
    await this._init();
    await this.api.delete(`${this.remoteBaseDir}/${key}`);
  }

  async mkdir(key: string): Promise<Entity> {
    await this._init();
    await this.api.mkdir(`${this.remoteBaseDir}/${key}`);
    return this.stat(key);
  }

  async stat(key: string): Promise<Entity> {
    const res = await this.api.getResource(`${this.remoteBaseDir}/${key}`);
    return {
        keyRaw: key,
        key: key,
        sizeRaw: res.size || 0,
        mtimeSvr: Date.parse(res.modified!).valueOf(),
    };
  }
}

export async function setConfigBySuccessfullAuthInplace(config: YandexDiskConfig, authRes: any, saveUpdatedConfigFunc: () => Promise<any> | undefined) {
    config.accessToken = authRes.access_token;
    config.refreshToken = authRes.refresh_token;
    config.accessTokenExpiresInMs = authRes.expires_in * 1000;
    config.accessTokenExpiresAtTimeMs = Date.now() + authRes.expires_in * 1000 - 60 * 5 * 1000;
    await saveUpdatedConfigFunc?.();
}
