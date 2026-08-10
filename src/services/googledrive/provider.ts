/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * FakeFs Provider for Google Drive
 */

import { FakeFs } from "../../core/fs/fsAll";
import { type Entity, GOOGLEDRIVE_CLIENT_ID, GOOGLEDRIVE_CLIENT_SECRET, type GoogleDriveConfig, DEFAULT_CONTENT_TYPE } from "../../core/baseTypes";
import { GoogleDriveApiClient } from "./client";
import { OAuth2Handler } from "../../auth/oauth2";
import * as mime from "mime-types";
import PQueue from "p-queue";

export class GoogleDriveProvider extends FakeFs {
  kind: "googledrive" = "googledrive";
  private api: GoogleDriveApiClient | null = null;
  private rootId: string | null = null;
  private cache = new Map<string, { id: string, isDir: boolean }>();

  constructor(
    private config: GoogleDriveConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    super();
  }

  async walk(): Promise<Entity[]> {
    await this.init();
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
        if (isDir) queue.add(() => scan(f.id, key));
      }
    };

    await scan(this.rootId!, "");
    await queue.onIdle();
    return list;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    await this.init();
    const entry = this.cache.get(path);
    if (!entry) throw new Error(`Not found: ${path}`);
    return await this.api!.downloadFile(entry.id);
  }

  async writeFile(path: string, content: ArrayBuffer, mtime: number): Promise<Entity> {
    await this.init();
    const entry = this.cache.get(path);
    const name = path.split("/").filter(Boolean).pop()!;
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/") + 1) : "";
    const parent = parentPath ? this.cache.get(parentPath) : { id: this.rootId };

    const meta = { name, modifiedTime: new Date(mtime).toISOString(), parents: entry ? undefined : [parent!.id] };
    const media = new Blob([content], { type: mime.lookup(name) || DEFAULT_CONTENT_TYPE });

    const updated = await this.api!.uploadFile(meta, media, entry?.id);
    const newEntity = {
      key: path, keyRaw: path,
      sizeRaw: content.byteLength,
      mtimeSvr: Date.parse(updated.modifiedTime!).valueOf(),
      hash: updated.md5Checksum
    };
    this.cache.set(path, { id: updated.id, isDir: false });
    return newEntity;
  }

  async rm(path: string): Promise<void> {
    await this.init();
    const entry = this.cache.get(path);
    if (entry) {
      await this.api!.deleteFile(entry.id);
      this.cache.delete(path);
    }
  }

  async mkdir(path: string): Promise<Entity> {
    await this.init();
    const name = path.replace(/\/$/, "").split("/").pop()!;
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/", path.length - 2) + 1) : "";
    const parent = parentPath ? this.cache.get(parentPath) : { id: this.rootId };

    const created = await this.api!.createFolder(name, [parent!.id]);
    const entity = { key: path, keyRaw: path, sizeRaw: 0, mtimeSvr: Date.now() };
    this.cache.set(path, { id: created.id, isDir: true });
    return entity;
  }

  private async init() {
    if (this.api && this.rootId) return;

    const oauth = new OAuth2Handler({
      clientId: GOOGLEDRIVE_CLIENT_ID,
      clientSecret: GOOGLEDRIVE_CLIENT_SECRET,
      authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      redirectUri: "urn:ietf:wg:oauth:2.0:oob", // or custom callback
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
  }
}
