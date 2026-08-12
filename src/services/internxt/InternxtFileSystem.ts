import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import type { Entity, InternxtConfig } from "../../core/baseTypes";
import { InternxtClient } from "./InternxtClient";

export class RawInternxtFs implements RawFs {
  private client: InternxtClient;
  private folderIdCache: Map<string, string> = new Map();
  private inFlightGetFolderId: Map<string, Promise<string>> = new Map();

  constructor(
    private config: InternxtConfig,
    private saveUpdatedConfigFunc: () => Promise<any>,
    appDetails?: { clientName: string; clientVersion: string }
  ) {
    this.client = new InternxtClient({
      token: config.token,
      mnemonic: config.mnemonic,
      bridgeUser: config.bridgeUser || config.email,
      userId: config.userId || "",
      rootFolderUuid: config.rootFolderUuid || "",
      bucketId: config.bucketId || ""
    }, appDetails);
  }

  private async getFolderId(path: string, createIfMissing = false): Promise<string> {
    const cacheKey = `${path}:${createIfMissing}`;
    if (this.inFlightGetFolderId.has(cacheKey)) {
      return this.inFlightGetFolderId.get(cacheKey)!;
    }

    const promise = (async () => {
      try {
        return await this.getFolderIdInternal(path, createIfMissing);
      } finally {
        this.inFlightGetFolderId.delete(cacheKey);
      }
    })();

    this.inFlightGetFolderId.set(cacheKey, promise);
    return promise;
  }

  private async getFolderIdInternal(path: string, createIfMissing = false): Promise<string> {
    if (path === "" || path === "/") {
      if (!this.config.rootFolderUuid) throw new Error("Root folder UUID not set");
      return this.config.rootFolderUuid;
    }
    if (this.folderIdCache.has(path)) return this.folderIdCache.get(path)!;

    const parts = path.split("/").filter(p => p !== "");
    let currentId = this.config.rootFolderUuid!;
    let currentPath = "";

    for (const part of parts) {
      currentPath += (currentPath === "" ? "" : "/") + part;

      if (this.folderIdCache.has(currentPath)) {
        currentId = this.folderIdCache.get(currentPath)!;
        continue;
      }

      const contents = await this.client.getFolderContents(currentId);
      let folder: any = null;
      if (contents.children) {
        for (const child of contents.children) {
          const name = child.plainName || child.plain_name || child.name;
          if (name === part) {
            folder = child;
            break;
          }
        }
      }

      if (!folder) {
        if (createIfMissing) {
          const res = await this.client.createFolder(currentId, part);
          folder = res;

          // Wait for folder to be recognized by Drive API in parent's children
          for (let i = 0; i < 15; i++) {
            const parentContents = await this.client.getFolderContents(currentId);
            const found = parentContents.children?.find((c: any) => c.uuid === folder.uuid);
            if (found) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          throw new Error(`Folder not found: ${part} in ${currentPath}`);
        }
      }

      currentId = folder.uuid;
      this.folderIdCache.set(currentPath, currentId);
    }

    return currentId;
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    let folderId: string;
    try {
      folderId = await this.getFolderId(fullPath);
    } catch (e: any) {
      if (e.message.includes("Folder not found")) {
        return [];
      }
      throw e;
    }
    const contents = await this.client.getFolderContents(folderId);

    const entities: Entity[] = [];

    if (contents.children) {
      for (const f of contents.children) {
        const name = f.plainName || f.plain_name || f.name;
        const key = (fullPath === "" ? "" : fullPath + "/") + name + "/";
        entities.push({
          key, keyRaw: key,
          size: 0, sizeRaw: 0,
          synthesizedFolder: true
        });
        this.folderIdCache.set(key.replace(/\/$/, ""), f.uuid);
      }
    }

    if (contents.files) {
      for (const f of contents.files) {
        const name = f.plainName || f.plain_name || f.name;
        const key = (fullPath === "" ? "" : fullPath + "/") + name;
        entities.push({
          key, keyRaw: key,
          size: Number(f.size || 0),
          sizeRaw: Number(f.size || 0),
          mtimeSvr: Date.parse(f.updatedAt).valueOf(),
          versionId: f.uuid
        });
      }
    }

    return entities;
  }

  async stat(fullPath: string): Promise<Entity> {
    const cleanPath = fullPath.replace(/\/$/, "");
    const parentPath = cleanPath.includes("/") ? cleanPath.split("/").slice(0, -1).join("/") : "";

    const entities = await this.walk(parentPath, false);
    const found = entities.find(e => e.key === fullPath || e.key === cleanPath || e.key === cleanPath + "/");
    if (!found) throw new Error(`Not found: ${fullPath}`);
    return found;
  }

  async mkdir(fullPath: string): Promise<Entity> {
    const cleanPath = fullPath.replace(/\/$/, "");
    await this.getFolderId(cleanPath, true);
    return await this.stat(fullPath);
  }

  async writeFile(fullPath: string, content: ArrayBuffer, mtime: number, ctime: number): Promise<Entity> {
    const parentPath = fullPath.includes("/") ? fullPath.split("/").slice(0, -1).join("/") : "";
    const name = fullPath.split("/").pop()!;
    const parentId = await this.getFolderId(parentPath, true); // Auto-create parent

    await this.client.uploadFile(parentId, name, Buffer.from(content), content.byteLength, mtime, ctime);

    // Polling for metadata consistency
    for (let i = 0; i < 10; i++) {
      try {
        return await this.stat(fullPath);
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    throw new Error(`Upload succeeded but metadata for ${fullPath} did not appear in time.`);
  }

  async readFile(fullPath: string, versionId?: string): Promise<ArrayBuffer> {
    const entity = await this.stat(fullPath);
    const data = await this.client.downloadFile(versionId || entity.versionId!);

    const ab = new ArrayBuffer(data.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < data.length; ++i) {
      view[i] = data[i];
    }
    return ab;
  }

  async rm(fullPath: string, versionId?: string): Promise<void> {
    const entity = await this.stat(fullPath);
    if (fullPath.endsWith("/")) {
      const folderId = await this.getFolderId(fullPath.replace(/\/$/, ""));
      await this.client.deleteFolder(folderId);
    } else {
      await this.client.deleteFile(versionId || entity.versionId!);
    }

    // Polling for deletion consistency
    for (let i = 0; i < 10; i++) {
      try {
        await this.stat(fullPath);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        return; // Success, it's gone
      }
    }
  }
}

export class InternxtFileSystem extends BaseCloudFs {
  constructor(
    config: InternxtConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<any>,
    appDetails?: { clientName: string; clientVersion: string }
  ) {
    super("internxt", new RawInternxtFs(config, saveUpdatedConfigFunc, appDetails), config.remoteBaseDir || vaultName);
  }

  async checkConnect(callbackFunc?: any): Promise<boolean> {
    try {
      // Basic check: list root
      await this.walk();
      return true;
    } catch (err) {
      callbackFunc?.(err);
      return false;
    }
  }
}
