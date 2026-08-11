/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Box Provider using BaseCloudFs
 */

import {
  type Entity,
  type BoxConfig,
  BOX_CLIENT_ID,
  BOX_CLIENT_SECRET,
} from "../../core/baseTypes";
import { BoxApiClient } from "./BoxClient";
import { OAuth2Handler } from "../../auth/oauth2";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";

export const DEFAULT_BOX_CONFIG: BoxConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  credentialsShouldBeDeletedAtTimeMs: 0,
  kind: "box",
};

export const generateAuthUrl = () => {
  const oauth = new OAuth2Handler({
    clientId: BOX_CLIENT_ID,
    clientSecret: BOX_CLIENT_SECRET,
    authEndpoint: "https://account.box.com/api/oauth2/authorize",
    tokenEndpoint: "https://api.box.com/oauth2/token",
    redirectUri: "obsidian://remotely-save-cb-box",
    scopes: [],
  });
  return oauth.getAuthUrl("state");
};

class RawBoxFs implements RawFs {
  private api: BoxApiClient | null = null;
  private rootId: string | null = null;
  private cache = new Map<string, string>(); // path -> boxId

  constructor(
    private config: BoxConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {}

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
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
          mtimeSvr: (item as any).modifiedAt ? Date.parse((item as any).modifiedAt as any).valueOf() : Date.now(),
        });
        if (!partial && isDir) await scan(item.id, key);
      }
    };

    const startFolderId = await this.resolvePathToId(fullPath);
    await scan(startFolderId, fullPath === "/" ? "" : fullPath.replace(/\/$/, "") + "/");
    return list;
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const id = await this.resolvePathToId(fullPath);
    // Fetching metadata for a single item by ID isn't directly exposed in our current Client,
    // but we can list parent and find it, or add a method to client.
    // For simplicity, let's assume it's in cache or we list children of parent.
    const normalized = fullPath.replace(/\/$/, "");
    const parentPath = normalized.substring(0, normalized.lastIndexOf("/") + 1) || "/";
    const parentId = await this.resolvePathToId(parentPath);
    const items = await this.api!.listItems(parentId);
    const item = items.entries?.find(i => i.id === id);
    if (!item) throw new Error(`Not found: ${fullPath}`);

    const isDir = item.type === "folder";
    return {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: (item as any).size || 0,
      mtimeSvr: (item as any).modifiedAt ? Date.parse((item as any).modifiedAt as any).valueOf() : Date.now(),
    };
  }

  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    const id = await this.resolvePathToId(fullPath);
    return await this.api!.downloadFile(id);
  }

  async writeFile(fullPath: string, content: ArrayBuffer, mtime: number, _ctime: number): Promise<Entity> {
    await this.ensureInited();
    const existingId = await this.resolvePathToId(fullPath).catch(() => null);
    const normalized = fullPath.replace(/\/$/, "");
    const fileName = normalized.split("/").pop()!;
    const parentPath = normalized.substring(0, normalized.lastIndexOf("/") + 1) || "/";
    const parentId = await this.resolvePathToId(parentPath);

    let file;
    if (existingId) {
      const res = await this.api!.updateFile(existingId, content);
      file = res.entries![0];
    } else {
      const res = await this.api!.uploadFile(parentId, fileName, content, mtime);
      file = res.entries![0];
    }

    this.cache.set(fullPath, file.id);
    return {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: file.size || 0,
      mtimeSvr: Date.parse(file.modifiedAt as any).valueOf(),
    };
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    try {
      const id = await this.resolvePathToId(fullPath);
      await this.api!.deleteFile(id);
      this.cache.delete(fullPath);
    } catch (e) {
      // Ignore
    }
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const normalized = fullPath.replace(/\/$/, "");
    const name = normalized.split("/").pop()!;
    const parentPath = normalized.substring(0, normalized.lastIndexOf("/") + 1) || "/";
    const parentId = await this.resolvePathToId(parentPath);

    const res = await this.api!.createFolder(parentId, name);
    this.cache.set(fullPath, res.id);
    return { key: fullPath, keyRaw: fullPath, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  private async resolvePathToId(fullPath: string): Promise<string> {
    const normalized = fullPath === "/" ? "/" : fullPath.replace(/\/$/, "");
    if (normalized === "/") return this.rootId!;
    if (this.cache.has(fullPath)) return this.cache.get(fullPath)!;
    if (this.cache.has(normalized)) return this.cache.get(normalized)!;

    const parts = normalized.split("/").filter(Boolean);
    let currId = this.rootId!;
    let currPath = "";
    for (const part of parts) {
      currPath += "/" + part;
      if (this.cache.has(currPath)) {
        currId = this.cache.get(currPath)!;
        continue;
      }
      const items = await this.api!.listItems(currId);
      const found = items.entries?.find(i => i.name === part);
      if (!found) throw new Error(`Path not found: ${currPath}`);
      currId = found.id;
      this.cache.set(currPath, currId);
    }
    return currId;
  }

  private async ensureInited() {
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
    this.cache.set("/", this.rootId);
  }

  async checkConnect(fullPath: string): Promise<boolean> {
    await this.ensureInited();
    await this.api!.listItems(this.rootId!);
    return true;
  }
}

export class BoxFileSystem extends BaseCloudFs {
  constructor(
    config: BoxConfig,
    vaultName: string,
    onConfigUpdate: () => Promise<void>
  ) {
    super("box", new RawBoxFs(config, vaultName, onConfigUpdate), config.remoteBaseDir || vaultName);
  }

  async checkConnect(callbackFunc?: any): Promise<boolean> {
    try {
      await (this.rawFs as RawBoxFs).checkConnect(this.toFullPath(""));
    } catch (err) {
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
