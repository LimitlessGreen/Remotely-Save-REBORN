/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * FakeFs Provider for Koofr
 */

import { FakeFs } from "../../core/fs/fsAll";
import { type Entity, type KoofrConfig, KOOFR_CLIENT_ID, KOOFR_CLIENT_SECRET } from "../../core/baseTypes";
import { KoofrApiClient } from "./client";
import { OAuth2Handler } from "../../auth/oauth2";

export class KoofrProvider extends FakeFs {
  kind: "koofr" = "koofr";
  private api: KoofrApiClient | null = null;
  private rootPath: string;

  constructor(
    private config: KoofrConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    super();
    this.rootPath = config.remoteBaseDir || vaultName;
  }

  async walk(): Promise<Entity[]> {
    await this.init();
    const list: Entity[] = [];

    const scan = async (currentPath: string, relBase: string) => {
      const data = await this.api!.listItems(this.config.mountID, currentPath);
      for (const item of data.files || []) {
        const isDir = item.type === "dir";
        const key = relBase + item.name + (isDir ? "/" : "");
        list.push({
          key, keyRaw: key,
          sizeRaw: item.size || 0,
          mtimeSvr: item.modified || Date.now(),
        });
        if (isDir) await scan(`${currentPath}/${item.name}`, key);
      }
    };

    await scan(`/${this.rootPath}`, "");
    return list;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    await this.init();
    return await this.api!.downloadFile(this.config.mountID, `/${this.rootPath}/${path}`);
  }

  async writeFile(path: string, content: ArrayBuffer): Promise<Entity> {
    await this.init();
    await this.api!.uploadFile(this.config.mountID, `/${this.rootPath}/${path}`, content);
    return {
      key: path, keyRaw: path,
      sizeRaw: content.byteLength,
      mtimeSvr: Date.now()
    };
  }

  async rm(path: string): Promise<void> {
    await this.init();
    await this.api!.delete(this.config.mountID, `/${this.rootPath}/${path}`);
  }

  async mkdir(path: string): Promise<Entity> {
    await this.init();
    await this.api!.createFolder(this.config.mountID, `/${this.rootPath}/${path}`);
    return { key: path, keyRaw: path, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  private async init() {
    if (this.api) return;

    const oauth = new OAuth2Handler({
      clientId: KOOFR_CLIENT_ID,
      clientSecret: KOOFR_CLIENT_SECRET,
      authEndpoint: `${this.config.api}/oauth2/auth`,
      tokenEndpoint: `${this.config.api}/oauth2/token`,
      redirectUri: "obsidian://remotely-save-cb-koofr",
      scopes: ["public"]
    });

    if (Date.now() >= this.config.accessTokenExpiresAtTimeMs) {
      const res = await oauth.refreshToken(this.config.refreshToken);
      this.config.accessToken = res.access_token;
      this.config.accessTokenExpiresAtTimeMs = Date.now() + (res.expires_in * 1000) - 300000;
      await this.onConfigUpdate();
    }

    this.api = new KoofrApiClient(this.config.accessToken, this.config.api);

    // Ensure root exists
    try {
      await this.api.createFolder(this.config.mountID, `/${this.rootPath}`);
    } catch { /* ignore if exists */ }
  }
}
