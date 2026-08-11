/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Google Drive Provider using BaseCloudFs
 */

import {
  type Entity,
  GOOGLEDRIVE_CLIENT_ID,
  GOOGLEDRIVE_CLIENT_SECRET,
  type GoogleDriveConfig,
  DEFAULT_CONTENT_TYPE,
} from "../../core/baseTypes";
import { GoogleDriveApiClient } from "./GoogleDriveClient";
import { OAuth2Handler } from "../../auth/oauth2";
import * as mime from "mime-types";
import PQueue from "p-queue";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";

export const DEFAULT_GOOGLEDRIVE_CONFIG: GoogleDriveConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  credentialsShouldBeDeletedAtTimeMs: 0,
  scope: "https://www.googleapis.com/auth/drive.file",
  kind: "googledrive",
};

class RawGoogleDriveFs implements RawFs {
  private api: GoogleDriveApiClient | null = null;
  private rootId: string | null = null;
  private cache = new Map<string, { id: string, isDir: boolean }>();

  constructor(
    private config: GoogleDriveConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {}

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
    const list: Entity[] = [];
    const queue = new PQueue({ concurrency: 5 });

    const scan = async (folderId: string, path: string) => {
      const data = await this.api!.listFiles(`'${folderId}' in parents and trashed = false`, "files(id,name,mimeType,size,md5Checksum,modifiedTime)");
      for (const f of data.files) {
        const isDir = f.mimeType === "application/vnd.google-apps.folder";
        const key = path + f.name + (isDir ? "/" : "");
        this.cache.set(key, { id: f.id, isDir });
        list.push({
          key, keyRaw: key,
          sizeRaw: isDir ? 0 : parseInt(f.size || "0"),
          mtimeSvr: f.modifiedTime ? Date.parse(f.modifiedTime).valueOf() : Date.now(),
          hash: f.md5Checksum
        });
        if (!partial && isDir) queue.add(() => scan(f.id, key));
      }
    };

    // fullPath passed here is usually "/" or similar.
    // However, Google Drive's folder structure is ID-based.
    // We need to resolve fullPath to an ID first if it's not root.
    const startFolderId = await this.resolvePathToId(fullPath);
    await scan(startFolderId, fullPath === "/" ? "" : fullPath.replace(/\/$/, "") + "/");
    await queue.onIdle();
    return list;
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const id = await this.resolvePathToId(fullPath);
    // For now we might need to fetch metadata if not in cache, but walk usually populates it.
    // A better way is to fetch by ID.
    const res = await this.api!.listFiles(`id = '${id}'`, "files(id,name,mimeType,size,md5Checksum,modifiedTime)");
    if (res.files.length === 0) throw new Error(`Not found: ${fullPath}`);
    const f = res.files[0];
    const isDir = f.mimeType === "application/vnd.google-apps.folder";
    return {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: isDir ? 0 : parseInt(f.size || "0"),
      mtimeSvr: f.modifiedTime ? Date.parse(f.modifiedTime).valueOf() : Date.now(),
      hash: f.md5Checksum
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
    const name = normalized.split("/").pop()!;
    const parentPath = normalized.substring(0, normalized.lastIndexOf("/") + 1) || "/";
    const parentId = await this.resolvePathToId(parentPath);

    const meta = { name, modifiedTime: new Date(mtime).toISOString(), parents: existingId ? undefined : [parentId] };
    const media = new Blob([content], { type: mime.lookup(name) || DEFAULT_CONTENT_TYPE });

    const updated = await this.api!.uploadFile(meta, media, existingId || undefined);
    const newEntity = {
      key: fullPath, keyRaw: fullPath,
      sizeRaw: content.byteLength,
      mtimeSvr: Date.parse(updated.modifiedTime!).valueOf(),
      hash: updated.md5Checksum
    };
    this.cache.set(fullPath, { id: updated.id, isDir: false });
    return newEntity;
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    try {
      const id = await this.resolvePathToId(fullPath);
      await this.api!.deleteFile(id);
      this.cache.delete(fullPath);
    } catch (e) {
      // Ignore if already deleted
    }
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const normalized = fullPath.replace(/\/$/, "");
    const name = normalized.split("/").pop()!;
    const parentPath = normalized.substring(0, normalized.lastIndexOf("/") + 1) || "/";
    const parentId = await this.resolvePathToId(parentPath);

    const created = await this.api!.createFolder(name, [parentId]);
    const entity = { key: fullPath, keyRaw: fullPath, sizeRaw: 0, mtimeSvr: Date.now() };
    this.cache.set(fullPath, { id: created.id, isDir: true });
    return entity;
  }

  private async resolvePathToId(fullPath: string): Promise<string> {
    const normalized = fullPath === "/" ? "/" : fullPath.replace(/\/$/, "");
    if (normalized === "/") return this.rootId!;

    if (this.cache.has(fullPath)) return this.cache.get(fullPath)!.id;
    if (this.cache.has(normalized)) return this.cache.get(normalized)!.id;

    // Resolve step by step
    const parts = normalized.split("/").filter(Boolean);
    let currId = this.rootId!;
    let currPath = "";
    for (const part of parts) {
      currPath += "/" + part;
      if (this.cache.has(currPath)) {
        currId = this.cache.get(currPath)!.id;
        continue;
      }
      const res = await this.api!.listFiles(`'${currId}' in parents and name = '${part}' and trashed = false`, "files(id,mimeType)");
      if (res.files.length === 0) throw new Error(`Path not found: ${currPath}`);
      currId = res.files[0].id;
      this.cache.set(currPath, { id: currId, isDir: res.files[0].mimeType === "application/vnd.google-apps.folder" });
    }
    return currId;
  }

  private async ensureInited() {
    if (this.api && this.rootId) return;

    const oauth = new OAuth2Handler({
      clientId: GOOGLEDRIVE_CLIENT_ID,
      clientSecret: GOOGLEDRIVE_CLIENT_SECRET,
      authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      redirectUri: "urn:ietf:wg:oauth:2.0:oob",
      scopes: ["https://www.googleapis.com/auth/drive.file"]
    });

    if (Date.now() >= this.config.accessTokenExpiresAtTimeMs) {
      const tokens = await oauth.refreshToken(this.config.refreshToken);
      this.config.accessToken = tokens.access_token;
      this.config.accessTokenExpiresAtTimeMs = Date.now() + (tokens.expires_in * 1000) - 300000;
      await this.onConfigUpdate();
    }

    this.api = new GoogleDriveApiClient(this.config.accessToken);

    const folderName = this.config.remoteBaseDir || this.vaultName;
    const res = await this.api.listFiles(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, "files(id)");
    if (res.files.length > 0) {
      this.rootId = res.files[0].id;
    } else {
      const created = await this.api.createFolder(folderName);
      this.rootId = created.id;
    }
    this.cache.set("/", { id: this.rootId, isDir: true });
  }

  async checkConnect(fullPath: string): Promise<boolean> {
    await this.ensureInited();
    await this.api!.listFiles(`'${this.rootId}' in parents`, "files(id)");
    return true;
  }
}

export class GoogleDriveFileSystem extends BaseCloudFs {
  constructor(
    config: GoogleDriveConfig,
    vaultName: string,
    onConfigUpdate: () => Promise<void>
  ) {
    super("googledrive", new RawGoogleDriveFs(config, vaultName, onConfigUpdate), config.remoteBaseDir || vaultName);
  }

  async checkConnect(callbackFunc?: any): Promise<boolean> {
    try {
      await (this.rawFs as RawGoogleDriveFs).checkConnect(this.toFullPath(""));
    } catch (err) {
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
