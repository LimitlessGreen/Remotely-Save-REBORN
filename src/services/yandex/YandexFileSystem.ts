/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Yandex Disk Provider using BaseCloudFs
 */

import {
  type Entity,
  type YandexDiskConfig,
  YANDEXDISK_CLIENT_ID,
  YANDEXDISK_CLIENT_SECRET,
} from "../../core/baseTypes";
import { YandexDiskApiClient } from "./YandexClient";
import { OAuth2Handler } from "../../auth/oauth2";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";

export const DEFAULT_YANDEXDISK_CONFIG: YandexDiskConfig = {
  accessToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  refreshToken: "",
  scope: "",
  kind: "yandexdisk",
};

export const generateAuthUrl = (hasCallback: boolean) => {
  const clientID = YANDEXDISK_CLIENT_ID ?? "";
  const redirectUri = hasCallback
    ? "obsidian://remotely-save-cb-yandexdisk"
    : "https://oauth.yandex.com/verification_code";
  return `https://oauth.yandex.com/authorize?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}`;
};

class RawYandexDiskFs implements RawFs {
  private api: YandexDiskApiClient | null = null;
  private rootPath: string;

  constructor(
    private config: YandexDiskConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    this.rootPath = config.remoteBaseDir || vaultName;
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
    const list: Entity[] = [];

    const scan = async (path: string, relBase: string) => {
      const data = await this.api!.getResource(path);
      for (const item of data._embedded?.items || []) {
        const isDir = item.type === "dir";
        const key = relBase + item.name + (isDir ? "/" : "");
        list.push({
          key, keyRaw: key,
          sizeRaw: item.size || 0,
          mtimeSvr: Date.parse(item.modified!).valueOf(),
        });
        if (!partial && isDir) await scan(item.path!.replace("disk:", ""), key);
      }
    };

    // fullPath passed here is relative to root.
    // However, Yandex API uses absolute paths on the disk.
    // Our root is this.rootPath.
    await scan(this.rootPath + (fullPath === "/" ? "" : fullPath), fullPath === "/" ? "" : fullPath.replace(/\/$/, "") + "/");
    return list;
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const meta = await this.api!.getResource(this.rootPath + fullPath);
    const isDir = meta.type === "dir";
    return {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: meta.size || 0,
      mtimeSvr: Date.parse(meta.modified!).valueOf(),
    };
  }

  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    const link = await this.api!.getDownloadLink(this.rootPath + fullPath);
    const res = await fetch(link.href);
    return await res.arrayBuffer();
  }

  async writeFile(fullPath: string, content: ArrayBuffer, _mtime: number, _ctime: number): Promise<Entity> {
    await this.ensureInited();
    const link = await this.api!.getUploadLink(this.rootPath + fullPath, true);
    await fetch(link.href, { method: "PUT", body: content });

    const meta = await this.api!.getResource(this.rootPath + fullPath);
    return {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: meta.size || 0,
      mtimeSvr: Date.parse(meta.modified!).valueOf(),
    };
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    await this.api!.delete(this.rootPath + fullPath);
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    await this.api!.mkdir(this.rootPath + fullPath);
    return { key: fullPath, keyRaw: fullPath, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  private async ensureInited() {
    if (this.api) return;

    const oauth = new OAuth2Handler({
      clientId: YANDEXDISK_CLIENT_ID,
      clientSecret: YANDEXDISK_CLIENT_SECRET,
      authEndpoint: "https://oauth.yandex.com/authorize",
      tokenEndpoint: "https://oauth.yandex.com/token",
      redirectUri: "obsidian://remotely-save-cb-yandexdisk",
      scopes: []
    });

    if (Date.now() >= this.config.accessTokenExpiresAtTimeMs) {
      const res = await oauth.refreshToken(this.config.refreshToken);
      this.config.accessToken = res.access_token;
      this.config.accessTokenExpiresAtTimeMs = Date.now() + (res.expires_in * 1000) - 300000;
      await this.onConfigUpdate();
    }

    this.api = new YandexDiskApiClient(this.config.accessToken);

    try {
      await this.api.getResource(this.rootPath);
    } catch {
      await this.api.mkdir(this.rootPath);
    }
  }

  async checkConnect(fullPath: string): Promise<boolean> {
    await this.ensureInited();
    await this.api!.getResource(this.rootPath + fullPath);
    return true;
  }
}

export class YandexFileSystem extends BaseCloudFs {
  constructor(
    config: YandexDiskConfig,
    vaultName: string,
    onConfigUpdate: () => Promise<void>
  ) {
    super("yandexdisk", new RawYandexDiskFs(config, vaultName, onConfigUpdate), config.remoteBaseDir || vaultName);
  }

  async checkConnect(callbackFunc?: any): Promise<boolean> {
    try {
      await (this.rawFs as RawYandexDiskFs).checkConnect(this.toFullPath(""));
    } catch (err) {
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
