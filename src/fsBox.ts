import {
  BoxOAuth,
  OAuthConfig,
} from "box-typescript-sdk-gen/lib/box/oauth.generated";
import { BoxClient } from "box-typescript-sdk-gen/lib/client.generated";
import type { FileFull } from "box-typescript-sdk-gen/lib/schemas/fileFull.generated";
import type { FolderFull } from "box-typescript-sdk-gen/lib/schemas/folderFull.generated";
import * as mime from "mime-types";
import PQueue from "p-queue";
import {
  DEFAULT_CONTENT_TYPE,
  type Entity,
  BOX_CLIENT_ID,
  BOX_CLIENT_SECRET,
  type BoxConfig,
  COMMAND_CALLBACK_BOX,
} from "./baseTypes";
import { FakeFs } from "./fsAll";

export const DEFAULT_BOX_CONFIG: BoxConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  credentialsShouldBeDeletedAtTimeMs: 0,
  kind: "box",
};

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Box storage service
 */

export const generateAuthUrl = () => {
  const config = new OAuthConfig({
    clientId: BOX_CLIENT_ID ?? "",
    clientSecret: BOX_CLIENT_SECRET ?? "",
  });
  const oauth = new BoxOAuth({ config: config });
  return oauth.getAuthorizeUrl({
    redirectUri: `obsidian://${COMMAND_CALLBACK_BOX}`,
  });
};

export const sendAuthReq = async (authCode: string, errorCallBack: any) => {
  try {
    const params = new URLSearchParams({
      code: authCode,
      grant_type: "authorization_code",
      client_id: BOX_CLIENT_ID ?? "",
      client_secret: BOX_CLIENT_SECRET ?? "",
    });
    const resp = await fetch(`https://api.box.com/oauth2/token`, {
      method: "POST",
      body: params,
    });
    return await resp.json();
  } catch (e) {
    console.error(e);
    if (errorCallBack) await errorCallBack(e);
  }
};

export const sendRefreshTokenReq = async (refreshToken: string) => {
  const params = new URLSearchParams({
    client_id: BOX_CLIENT_ID ?? "",
    client_secret: BOX_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return await res.json();
};

export class FakeFsBox extends FakeFs {
  kind: "box" = "box";
  config: BoxConfig;
  remoteBaseDir: string;
  saveUpdatedConfigFunc: () => Promise<any>;
  client: BoxClient;
  vaultFolderId = "";

  constructor(
    config: BoxConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<any>
  ) {
    super();
    this.config = config;
    this.remoteBaseDir = config.remoteBaseDir || vaultName;
    this.saveUpdatedConfigFunc = saveUpdatedConfigFunc;

    // We use a custom auth for BoxClient that handles our tokens
    this.client = new BoxClient({
        auth: {
            retrieveToken: async () => {
                if (Date.now() > this.config.accessTokenExpiresAtTimeMs) {
                    const res = await sendRefreshTokenReq(this.config.refreshToken);
                    this.config.accessToken = res.access_token;
                    this.config.accessTokenExpiresInMs = res.expires_in * 1000;
                    this.config.accessTokenExpiresAtTimeMs = Date.now() + res.expires_in * 1000 - 60 * 5 * 1000;
                    await this.saveUpdatedConfigFunc();
                }
                return { accessToken: this.config.accessToken };
            }
        } as any
    });
  }

  async _init() {
    if (!this.vaultFolderId) {
        const rootItems = await this.client.folders.getFolderItems("0");
        const vaultFolder = rootItems.entries?.find(i => i.name === this.remoteBaseDir && i.type === "folder");
        if (vaultFolder) {
            this.vaultFolderId = vaultFolder.id;
        } else {
            const created = await this.client.folders.createFolder({
                name: this.remoteBaseDir,
                parent: { id: "0" }
            });
            this.vaultFolderId = created.id;
        }
    }
  }

  async walk(): Promise<Entity[]> {
    await this._init();
    const allFiles: Entity[] = [];
    const walkInternal = async (folderId: string, path: string) => {
        const items = await this.client.folders.getFolderItems(folderId);
        for (const item of items.entries || []) {
            const isFolder = item.type === "folder";
            const keyRaw = path + item.name + (isFolder ? "/" : "");
            const entity: Entity = {
                keyRaw,
                key: keyRaw,
                sizeRaw: (item as any).size || 0,
                // Box API v2 doesn't always return mtime in mini-format, might need full get
            };
            allFiles.push(entity);
            if (isFolder) await walkInternal(item.id, keyRaw);
        }
    };
    await walkInternal(this.vaultFolderId, "");
    return allFiles;
  }

  async readFile(key: string): Promise<ArrayBuffer> {
    // TBD: Use Box SDK to download
    throw new Error("Box readFile not yet implemented");
  }

  async writeFile(key: string, content: ArrayBuffer, mtime: number, ctime: number): Promise<Entity> {
    // TBD: Use Box SDK to upload
    throw new Error("Box writeFile not yet implemented");
  }

  async rm(key: string): Promise<void> {
    // TBD: Use Box SDK to delete
  }

  async mkdir(key: string): Promise<Entity> {
    // TBD: Use Box SDK to create folder
    throw new Error("Box mkdir not yet implemented");
  }
}

export async function setConfigBySuccessfullAuthInplace(config: BoxConfig, authRes: any, saveUpdatedConfigFunc: () => Promise<any> | undefined) {
    config.accessToken = authRes.access_token;
    config.refreshToken = authRes.refresh_token;
    config.accessTokenExpiresInMs = authRes.expires_in * 1000;
    config.accessTokenExpiresAtTimeMs = Date.now() + authRes.expires_in * 1000 - 60 * 5 * 1000;
    config.credentialsShouldBeDeletedAtTimeMs = Date.now() + 1000 * 60 * 60 * 24 * 59;
    await saveUpdatedConfigFunc?.();
}
