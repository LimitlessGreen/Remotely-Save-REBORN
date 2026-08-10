/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * FakeFs Provider for Box
 */

import { FakeFs } from "../../fsAll";
import { type Entity, type BoxConfig, BOX_CLIENT_ID, BOX_CLIENT_SECRET } from "../../baseTypes";
import { BoxApiClient } from "./client";
import { OAuth2Handler } from "../../auth/oauth2";

export class BoxProvider extends FakeFs {
  kind: "box" = "box";
  private api: BoxApiClient | null = null;
  private rootId: string | null = null;
  private cache = new Map<string, string>(); // path -> boxId

  constructor(
    private config: BoxConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    super();
  }

  async walk(): Promise<Entity[]> {
    await this.init();
    const list: Entity[] = [];

    const scan = async (folderId: string, path: string) => {
      const items = await this.api!.listItems(folderId);
      for (const item of items.entries || []) {
        const isDir = item.type === "folder";
        const key = path + item.name + (isDir ? "/" : "");
        this.cache.set(key, item.id);
        list.push({
          key, keyRaw: key,
          sizeRaw: (item as any).size || 0,
          mtimeSvr: (item as any).modified_at ? Date.parse((item as any).modified_at).valueOf() : Date.now(),
        });
        if (isDir) await scan(item.id, key);
      }
    };

    await scan(this.rootId!, "");
    return list;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    await this.init();
    const id = this.cache.get(path);
    if (!id) throw new Error(`Not found: ${path}`);
    return await this.api!.downloadFile(id);
  }

  async writeFile(path: string, content: ArrayBuffer, mtime: number): Promise<Entity> {
    await this.init();
    const existingId = this.cache.get(path);
    const fileName = path.split("/").filter(Boolean).pop()!;
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/") + 1) : "";
    const parentId = parentPath ? this.cache.get(parentPath) : this.rootId;

    let file;
    if (existingId) {
      const res = await this.api!.updateFile(existingId, content);
      file = res.entries![0];
    } else {
      const res = await this.api!.uploadFile(parentId!, fileName, content, mtime);
      file = res.entries![0];
    }

    this.cache.set(path, file.id);
    return {
      key: path, keyRaw: path,
      sizeRaw: file.size || 0,
      mtimeSvr: Date.parse(file.modified_at!).valueOf(),
    };
  }

  async rm(path: string): Promise<void> {
    await this.init();
    const id = this.cache.get(path);
    if (id) {
      await this.api!.deleteFile(id);
      this.cache.delete(path);
    }
  }

  async mkdir(path: string): Promise<Entity> {
    await this.init();
    const name = path.replace(/\/$/, "").split("/").pop()!;
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/", path.length - 2) + 1) : "";
    const parentId = parentPath ? this.cache.get(parentPath) : this.rootId;

    const res = await this.api!.createFolder(parentId!, name);
    this.cache.set(path, res.id);
    return { key: path, keyRaw: path, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  private async init() {
    if (this.api && this.rootId) return;

    const oauth = new OAuth2Handler({
      clientId: BOX_CLIENT_ID,
      clientSecret: BOX_CLIENT_SECRET,
      authEndpoint: "https://account.box.com/api/oauth2/authorize",
      tokenEndpoint: "https://api.box.com/oauth2/token",
      redirectUri: "obsidian://remotely-save-cb-box",
      scopes: []
    });

    if (Date.now() >= this.config.accessTokenExpiresAtTimeMs) {
      const res = await oauth.refreshToken(this.config.refreshToken);
      this.config.accessToken = res.access_token;
      this.config.accessTokenExpiresAtTimeMs = Date.now() + (res.expires_in * 1000) - 300000;
      await this.onConfigUpdate();
    }

    this.api = new BoxApiClient(this.config.accessToken);

    const folderName = this.config.remoteBaseDir || this.vaultName;
    const found = await this.api.getFolderByName("0", folderName);
    if (found) {
      this.rootId = found.id;
    } else {
      const created = await this.api.createFolder("0", folderName);
      this.rootId = created.id;
    }
  }
}
