import type { Entity, InternxtConfig } from "../../core/baseTypes";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import { InternxtClient } from "./InternxtClient";

export class RawInternxtFs implements RawFs {
  private client: InternxtClient;
  private folderIdCache: Map<string, string> = new Map();
  private inFlightGetFolderId: Map<string, Promise<string>> = new Map();

  constructor(
    private config: InternxtConfig,
    _saveUpdatedConfigFunc: () => Promise<void>,
    appDetails?: { clientName: string; clientVersion: string }
  ) {
    this.client = new InternxtClient(
      {
        token: config.token,
        mnemonic: config.mnemonic,
        bridgeUser: config.bridgeUser || config.email,
        userId: config.userId || "",
        rootFolderUuid: config.rootFolderUuid || "",
        bucketId: config.bucketId || "",
      },
      appDetails
    );
  }

  private async getFolderId(
    path: string,
    createIfMissing = false
  ): Promise<string> {
    const cacheKey = `${path}:${createIfMissing}`;
    const inFlight = this.inFlightGetFolderId.get(cacheKey);
    if (inFlight) {
      return inFlight;
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

  private async getFolderIdInternal(
    path: string,
    createIfMissing = false
  ): Promise<string> {
    if (path === "" || path === "/") {
      const rootId = this.config.rootFolderUuid;
      if (!rootId) throw new Error("Root folder UUID not set");
      return rootId;
    }
    const cached = this.folderIdCache.get(path);
    if (cached) return cached;

    const parts = path.split("/").filter((p) => p !== "");
    let currentId = this.config.rootFolderUuid;
    if (!currentId) throw new Error("Root folder UUID not set");
    let currentPath = "";

    for (const part of parts) {
      currentPath += (currentPath === "" ? "" : "/") + part;

      const cachedPart = this.folderIdCache.get(currentPath);
      if (cachedPart) {
        currentId = cachedPart;
        continue;
      }

      const contents = await this.client.getFolderContents(currentId);
      let folder: { uuid: string } | null = null;
      if (contents.children) {
        for (const child of contents.children) {
          const name = child.plainName || child.plain_name || child.name;
          if (name === part) {
            folder = child as { uuid: string };
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
            const parentContents =
              await this.client.getFolderContents(currentId);
            const found = parentContents.children?.find(
              (c: { uuid: string }) =>
                c.uuid === (folder as { uuid: string }).uuid
            );
            if (found) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
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

  async walk(fullPath: string, _partial: boolean): Promise<Entity[]> {
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
        const separator = fullPath === "" || fullPath.endsWith("/") ? "" : "/";
        const key = fullPath + separator + name + "/";
        entities.push({
          key,
          keyRaw: key,
          size: 0,
          sizeRaw: 0,
          synthesizedFolder: true,
        });
        this.folderIdCache.set(key.replace(/\/$/, ""), f.uuid);
      }
    }

    if (contents.files) {
      for (const f of contents.files) {
        let name = f.plainName || f.plain_name || f.name;
        if (f.type && !name.endsWith("." + f.type)) {
          name = name + "." + f.type;
        }

        const separator = fullPath === "" || fullPath.endsWith("/") ? "" : "/";
        const key = fullPath + separator + name;
        entities.push({
          key,
          keyRaw: key,
          size: Number(f.size || 0),
          sizeRaw: Number(f.size || 0),
          mtimeSvr: Date.parse(f.updatedAt).valueOf(),
          versionId: f.uuid,
        });
      }
    }

    return entities;
  }

  async stat(fullPath: string): Promise<Entity> {
    const cleanPath = fullPath.replace(/\/$/, "");
    const parentPath = cleanPath.includes("/")
      ? cleanPath.split("/").slice(0, -1).join("/")
      : "";

    const entities = await this.walk(parentPath, false);
    const found = entities.find(
      (e) =>
        e.key === fullPath || e.key === cleanPath || e.key === cleanPath + "/"
    );
    if (!found) throw new Error(`Not found: ${fullPath}`);
    return found;
  }

  async mkdir(fullPath: string): Promise<Entity> {
    const cleanPath = fullPath.replace(/\/$/, "");
    await this.getFolderId(cleanPath, true);
    return await this.stat(fullPath);
  }

  async writeFile(
    fullPath: string,
    content: ArrayBuffer,
    mtime: number,
    ctime: number
  ): Promise<Entity> {
    const parentPath = fullPath.includes("/")
      ? fullPath.split("/").slice(0, -1).join("/")
      : "";
    const name = fullPath.split("/").pop()!;
    const parentId = await this.getFolderId(parentPath, true); // Auto-create parent

    await this.client.uploadFile(
      parentId,
      name,
      Buffer.from(content),
      content.byteLength,
      mtime,
      ctime
    );

    // Polling for metadata consistency
    for (let i = 0; i < 10; i++) {
      try {
        return await this.stat(fullPath);
      } catch (_e) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    throw new Error(
      `Upload succeeded but metadata for ${fullPath} did not appear in time.`
    );
  }

  async readFile(fullPath: string, versionId?: string): Promise<ArrayBuffer> {
    const entity = await this.stat(fullPath);
    const id = versionId || entity.versionId;
    if (!id) throw new Error(`Missing version ID for ${fullPath}`);
    const data = await this.client.downloadFile(id);

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
      const id = versionId || entity.versionId;
      if (!id) throw new Error(`Missing version ID for ${fullPath}`);
      await this.client.deleteFile(id);
    }

    // Polling for deletion consistency
    for (let i = 0; i < 10; i++) {
      try {
        await this.stat(fullPath);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (_e) {
        return; // Success, it's gone
      }
    }
  }
}

export class InternxtFileSystem extends BaseCloudFs {
  constructor(
    config: InternxtConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<void>,
    appDetails?: { clientName: string; clientVersion: string }
  ) {
    super(
      "internxt",
      new RawInternxtFs(config, saveUpdatedConfigFunc, appDetails),
      config.remoteBaseDir || vaultName
    );
  }

  async checkConnect(callbackFunc?: (err?: unknown) => void): Promise<boolean> {
    try {
      // Basic check: list root
      await this.walk("/", true);
      return true;
    } catch (err: unknown) {
      callbackFunc?.(err);
      return false;
    }
  }
}
