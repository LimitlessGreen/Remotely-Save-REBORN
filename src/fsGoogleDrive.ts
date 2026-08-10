import * as mime from "mime-types";
import { requestUrl } from "obsidian";
import PQueue from "p-queue";
import { DEFAULT_CONTENT_TYPE, type Entity } from "./baseTypes";
import { FakeFs } from "./fsAll";
import {
  getFolderLevels,
  splitFileSizeToChunkRanges,
  unixTimeToStr,
} from "./misc";
import {
  GOOGLEDRIVE_CLIENT_ID,
  GOOGLEDRIVE_CLIENT_SECRET,
  type GoogleDriveConfig,
} from "./baseTypes";

export const DEFAULT_GOOGLEDRIVE_CONFIG: GoogleDriveConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  scope: "https://www.googleapis.com/auth/drive.file",
  kind: "googledrive",
};

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

interface File {
  kind?: string;
  id?: string;
  name?: string;
  mimeType?: string;
  parents?: string[];
  size?: string;
  md5Checksum?: string;
  createdTime?: string;
  modifiedTime?: string;
  trashed?: boolean;
}

interface GDEntity extends Entity {
  id: string;
  parentID: string | undefined;
  isFolder: boolean;
}

export const sendRefreshTokenReq = async (refreshToken: string) => {
  console.debug(`refreshing google drive token`);
  const params = new URLSearchParams({
    client_id: GOOGLEDRIVE_CLIENT_ID,
    client_secret: GOOGLEDRIVE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (res.status !== 200) {
    throw Error(`refresh google drive token failed! status=${res.status}`);
  }
  return await res.json();
};

export class FakeFsGoogleDrive extends FakeFs {
  kind: "googledrive" = "googledrive";
  config: GoogleDriveConfig;
  remoteBaseDir: string;
  saveUpdatedConfigFunc: () => Promise<any>;
  vaultFolderExists = false;
  baseDirID = "";
  keyToGDEntity: Record<string, GDEntity> = {};

  constructor(
    config: GoogleDriveConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<any>
  ) {
    super();
    this.config = config;
    this.remoteBaseDir = config.remoteBaseDir || vaultName;
    this.saveUpdatedConfigFunc = saveUpdatedConfigFunc;
  }

  async _getAccessToken() {
    if (Date.now() > this.config.accessTokenExpiresAtTimeMs) {
      const res = await sendRefreshTokenReq(this.config.refreshToken);
      this.config.accessToken = res.access_token;
      this.config.accessTokenExpiresInMs = res.expires_in * 1000;
      this.config.accessTokenExpiresAtTimeMs = Date.now() + res.expires_in * 1000 - 60 * 5 * 1000;
      await this.saveUpdatedConfigFunc();
    }
    return this.config.accessToken;
  }

  async _init() {
    if (!this.config.refreshToken) throw new Error("Google Drive not authorized");
    await this._getAccessToken();

    if (!this.vaultFolderExists) {
      const q = `name='${this.remoteBaseDir}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", q);
      url.searchParams.set("fields", "files(id,name)");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.config.accessToken}` }
      });
      const data = await res.json();

      if (data.files && data.files.length > 0) {
        this.baseDirID = data.files[0].id;
        this.vaultFolderExists = true;
      } else {
        // Create it
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: this.remoteBaseDir,
            mimeType: FOLDER_MIME_TYPE
          })
        });
        const created = await createRes.json();
        this.baseDirID = created.id;
        this.vaultFolderExists = true;
      }
    }
  }

  async walk(): Promise<Entity[]> {
    await this._init();
    const allFiles: GDEntity[] = [];
    const queue = new PQueue({ concurrency: 5 });

    const walkFolder = async (folderID: string, path: string) => {
      let pageToken = "";
      do {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set("q", `'${folderID}' in parents and trashed=false`);
        url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,md5Checksum,modifiedTime)");
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${this.config.accessToken}` }
        });
        const data = await res.json();

        for (const file of data.files) {
          const isFolder = file.mimeType === FOLDER_MIME_TYPE;
          const keyRaw = path + file.name + (isFolder ? "/" : "");
          const entity: GDEntity = {
            id: file.id,
            keyRaw,
            key: keyRaw,
            sizeRaw: isFolder ? 0 : parseInt(file.size || "0"),
            mtimeSvr: Date.parse(file.modifiedTime).valueOf(),
            hash: file.md5Checksum,
            isFolder,
            parentID: folderID
          };
          allFiles.push(entity);
          this.keyToGDEntity[keyRaw] = entity;

          if (isFolder) {
            queue.add(() => walkFolder(file.id, keyRaw));
          }
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
    };

    queue.add(() => walkFolder(this.baseDirID, ""));
    await queue.onIdle();
    return allFiles;
  }

  async readFile(key: string): Promise<ArrayBuffer> {
    await this._init();
    const entity = this.keyToGDEntity[key];
    if (!entity) throw new Error(`File not found: ${key}`);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${entity.id}?alt=media`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }
    });
    return await res.arrayBuffer();
  }

  async writeFile(key: string, content: ArrayBuffer, mtime: number, ctime: number): Promise<Entity> {
    await this._init();
    const entity = this.keyToGDEntity[key];
    const fileName = key.split("/").pop()!;
    const parentPath = key.includes("/") ? key.substring(0, key.lastIndexOf("/") + 1) : "";
    const parentID = parentPath ? this.keyToGDEntity[parentPath]?.id : this.baseDirID;

    if (!parentID && parentPath) throw new Error(`Parent folder not found: ${parentPath}`);

    const metadata = {
      name: fileName,
      modifiedTime: new Date(mtime).toISOString(),
      parents: entity ? undefined : [parentID]
    };

    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("media", new Blob([content], { type: mime.lookup(fileName) || DEFAULT_CONTENT_TYPE }));

    const url = entity
      ? `https://www.googleapis.com/upload/drive/v3/files/${entity.id}?uploadType=multipart&fields=id,name,mimeType,size,md5Checksum,modifiedTime`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,md5Checksum,modifiedTime`;

    const res = await fetch(url, {
      method: entity ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      body: formData
    });
    const updated = await res.json();

    const newEntity: GDEntity = {
      id: updated.id,
      keyRaw: key,
      key: key,
      sizeRaw: parseInt(updated.size || "0"),
      mtimeSvr: Date.parse(updated.modifiedTime).valueOf(),
      hash: updated.md5Checksum,
      isFolder: false,
      parentID: parentID!
    };
    this.keyToGDEntity[key] = newEntity;
    return newEntity;
  }

  async rm(key: string): Promise<void> {
    await this._init();
    const entity = this.keyToGDEntity[key];
    if (!entity) return;

    await fetch(`https://www.googleapis.com/drive/v3/files/${entity.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.config.accessToken}` }
    });
    delete this.keyToGDEntity[key];
  }

  async mkdir(key: string): Promise<Entity> {
    await this._init();
    const fileName = key.endsWith("/") ? key.substring(0, key.length - 1).split("/").pop()! : key.split("/").pop()!;
    const parentPath = key.includes("/") ? key.substring(0, key.lastIndexOf("/", key.length - 2) + 1) : "";
    const parentID = parentPath ? this.keyToGDEntity[parentPath]?.id : this.baseDirID;

    const res = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: fileName,
        mimeType: FOLDER_MIME_TYPE,
        parents: [parentID]
      })
    });
    const created = await res.json();
    const entity: GDEntity = {
      id: created.id,
      keyRaw: key,
      key: key,
      sizeRaw: 0,
      mtimeSvr: Date.now(),
      isFolder: true,
      parentID: parentID!
    };
    this.keyToGDEntity[key] = entity;
    return entity;
  }
}
