/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * FakeFs Provider for Yandex Disk
 */

import { FakeFs } from "../../core/fs/fsAll";
import { type Entity, type YandexDiskConfig, YANDEXDISK_CLIENT_ID, YANDEXDISK_CLIENT_SECRET } from "../../core/baseTypes";
import { YandexDiskApiClient } from "./client";
import { OAuth2Handler } from "../../auth/oauth2";

export class YandexDiskProvider extends FakeFs {
  kind: "yandexdisk" = "yandexdisk";
  private api: YandexDiskApiClient | null = null;
  private rootPath: string;

  constructor(
    private config: YandexDiskConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    super();
    this.rootPath = config.remoteBaseDir || vaultName;
  }

  async walk(): Promise<Entity[]> {
    await this.init();
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
        if (isDir) await scan(item.path!.replace("disk:", ""), key);
      }
    };

    await scan(this.rootPath, "");
    return list;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    await this.init();
    const link = await this.api!.getDownloadLink(`${this.rootPath}/${path}`);
    const res = await fetch(link.href);
    return await res.arrayBuffer();
  }

  async writeFile(path: string, content: ArrayBuffer): Promise<Entity> {
    await this.init();
    const link = await this.api!.getUploadLink(`${this.rootPath}/${path}`, true);
    await fetch(link.href, { method: "PUT", body: content });

    const meta = await this.api!.getResource(`${this.rootPath}/${path}`);
    return {
      key: path, keyRaw: path,
      sizeRaw: meta.size || 0,
      mtimeSvr: Date.parse(meta.modified!).valueOf(),
    };
  }

  async rm(path: string): Promise<void> {
    await this.init();
    await this.api!.delete(`${this.rootPath}/${path}`);
  }

  async mkdir(path: string): Promise<Entity> {
    await this.init();
    await this.api!.mkdir(`${this.rootPath}/${path}`);
    return { key: path, keyRaw: path, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  private async init() {
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
}
