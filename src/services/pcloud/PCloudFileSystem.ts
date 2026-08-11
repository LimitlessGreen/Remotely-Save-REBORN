/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * pCloud Provider using BaseCloudFs
 */

import {
  type Entity,
  type PCloudConfig,
  PCLOUD_CLIENT_ID,
} from "../../core/baseTypes";
import { PCloudApiClient } from "./PCloudClient";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";

export const DEFAULT_PCLOUD_CONFIG: PCloudConfig = {
  accessToken: "",
  hostname: "api.pcloud.com",
  locationid: 1,
  credentialsShouldBeDeletedAtTimeMs: 0,
  emptyFile: "skip",
  kind: "pcloud",
};

export const generateAuthUrl = async () => {
  const clientID = PCLOUD_CLIENT_ID ?? "";
  const authUrl = `https://my.pcloud.com/oauth2/authorize?client_id=${clientID}&response_type=code`;
  return { authUrl };
};

class RawPCloudFs implements RawFs {
  private api: PCloudApiClient | null = null;
  private rootId: number | null = null;
  private idMap = new Map<string, number>();

  constructor(
    private config: PCloudConfig,
    private vaultName: string
  ) {}

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
    const list: Entity[] = [];

    const traverse = async (folderId: number, path: string) => {
      const res = await this.api!.listFolder(folderId);
      for (const item of res.contents || []) {
        const isDir = item.isfolder;
        const key = path + item.name + (isDir ? "/" : "");
        list.push({
          key, keyRaw: key,
          sizeRaw: item.size || 0,
          mtimeSvr: item.modified ? Date.parse(item.modified).valueOf() : Date.now(),
        });
        if (isDir) {
          this.idMap.set(key, item.folderid);
          if (!partial) await traverse(item.folderid, key);
        }
      }
    };

    const startFolderId = await this.resolvePathToId(fullPath);
    await traverse(startFolderId, fullPath === "/" ? "" : fullPath.replace(/\/$/, "") + "/");
    return list;
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    // pCloud API usually works with paths or IDs.
    // To implement stat via paths:
    const res = await this.api!.listFolder(await this.resolvePathToId(fullPath.substring(0, fullPath.lastIndexOf("/") + 1) || "/"));
    const name = fullPath.replace(/\/$/, "").split("/").pop()!;
    const item = res.contents?.find((i: any) => i.name === name);
    if (!item) throw new Error(`Not found: ${fullPath}`);

    const isDir = item.isfolder;
    return {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: item.size || 0,
      mtimeSvr: item.modified ? Date.parse(item.modified).valueOf() : Date.now(),
    };
  }

  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    return await this.api!.downloadFile(fullPath);
  }

  async writeFile(fullPath: string, content: ArrayBuffer): Promise<Entity> {
    await this.ensureInited();
    const name = fullPath.split("/").filter(Boolean).pop()!;
    const parentPath = fullPath.substring(0, fullPath.lastIndexOf("/") + 1) || "/";
    const parentId = await this.resolvePathToId(parentPath);

    const res = await this.api!.uploadFile(name, parentId, content);
    const meta = res.metadata[0];
    return {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: meta.size || 0,
      mtimeSvr: Date.parse(meta.modified).valueOf(),
    };
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    await this.api!.deleteFile(fullPath);
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const name = fullPath.replace(/\/$/, "").split("/").pop()!;
    const parentPath = fullPath.substring(0, fullPath.lastIndexOf("/", fullPath.length - 2) + 1) || "/";
    const parentId = await this.resolvePathToId(parentPath);

    const res = await this.api!.createFolder(name, parentId);
    this.idMap.set(fullPath, res.metadata.folderid);
    return { key: fullPath, keyRaw: fullPath, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  private async resolvePathToId(path: string): Promise<number> {
    const normalized = path === "/" ? "/" : path.replace(/\/$/, "");
    if (normalized === "/") return this.rootId!;
    if (this.idMap.has(path)) return this.idMap.get(path)!;
    if (this.idMap.has(normalized)) return this.idMap.get(normalized)!;

    // Resolve step by step if not in map
    const parts = normalized.split("/").filter(Boolean);
    let currId = this.rootId!;
    let currPath = "";
    for (const part of parts) {
      currPath += "/" + part;
      if (this.idMap.has(currPath)) {
        currId = this.idMap.get(currPath)!;
        continue;
      }
      const res = await this.api!.listFolder(currId);
      const found = res.contents?.find((i: any) => i.name === part && i.isfolder);
      if (!found) throw new Error(`Path not found: ${currPath}`);
      currId = found.folderid;
      this.idMap.set(currPath, currId);
    }
    return currId;
  }

  private async ensureInited() {
    if (this.api && this.rootId !== null) return;
    this.api = new PCloudApiClient(this.config.accessToken, this.config.locationid);

    const target = this.config.remoteBaseDir || this.vaultName;
    const root = await this.api.listFolder(0);
    const found = root.contents.find((i: any) => i.name === target && i.isfolder);

    if (found) {
      this.rootId = found.folderid;
    } else {
      const res = await this.api.createFolder(target, 0);
      this.rootId = res.metadata.folderid;
    }
    this.idMap.set("/", this.rootId!);
  }

  async checkConnect(fullPath: string): Promise<boolean> {
    await this.ensureInited();
    await this.api!.listFolder(this.rootId!);
    return true;
  }
}

export class PCloudFileSystem extends BaseCloudFs {
  constructor(
    config: PCloudConfig,
    vaultName: string
  ) {
    super("pcloud", new RawPCloudFs(config, vaultName), config.remoteBaseDir || vaultName);
  }

  async checkConnect(callbackFunc?: any): Promise<boolean> {
    try {
      await (this.rawFs as RawPCloudFs).checkConnect(this.toFullPath(""));
    } catch (err) {
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
