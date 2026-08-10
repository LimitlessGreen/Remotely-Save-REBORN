import { nanoid } from "nanoid";
import pcloudSdk from "pcloud-sdk-js";
import {
  type Entity,
  OAUTH2_FORCE_EXPIRE_MILLISECONDS,
  PCLOUD_CLIENT_ID,
  PCLOUD_CLIENT_SECRET,
  type PCloudConfig,
  COMMAND_CALLBACK_PCLOUD,
} from "./baseTypes";
import { FakeFs } from "./fsAll";

export const DEFAULT_PCLOUD_CONFIG: PCloudConfig = {
  accessToken: "",
  hostname: "api.pcloud.com",
  locationid: 1,
  credentialsShouldBeDeletedAtTimeMs: 0,
  emptyFile: "skip",
  kind: "pcloud",
};

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * pCloud storage service
 */

export const generateAuthUrl = async (hasCallback: boolean) => {
  const state = nanoid();
  let authUrl = `https://my.pcloud.com/oauth2/authorize?response_type=code&client_id=${PCLOUD_CLIENT_ID}&state=${state}`;
  if (hasCallback) {
    authUrl += `&redirect_uri=obsidian://${COMMAND_CALLBACK_PCLOUD}`;
  }
  return { authUrl, state };
};

export const sendAuthReq = async (hostname: string, authCode: string, errorCallBack: any) => {
  try {
    const params = new URLSearchParams({
      code: authCode,
      client_id: PCLOUD_CLIENT_ID ?? "",
      client_secret: PCLOUD_CLIENT_SECRET ?? "",
    });
    const res = await fetch(`https://${hostname}/oauth2_token`, {
      method: "POST",
      body: params,
    });
    const data = await res.json();
    if (data.result !== 0) throw new Error(data.error || "Auth failed");
    return data;
  } catch (e) {
    console.error(e);
    if (errorCallBack) await errorCallBack(e);
  }
};

export class FakeFsPCloud extends FakeFs {
  kind: "pcloud" = "pcloud";
  config: PCloudConfig;
  remoteBaseDir: string;
  saveUpdatedConfigFunc: () => Promise<any>;
  client: any;
  vaultFolderId = "";

  constructor(
    config: PCloudConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<any>
  ) {
    super();
    this.config = config;
    this.remoteBaseDir = config.remoteBaseDir || vaultName;
    this.saveUpdatedConfigFunc = saveUpdatedConfigFunc;
    this.client = pcloudSdk.createClient(this.config.accessToken, this.config.locationid);
  }

  async _init() {
    if (!this.vaultFolderId) {
        const res = await this.client.listfolder(0);
        const vaultFolder = res.contents.find((i: any) => i.name === this.remoteBaseDir && i.isfolder);
        if (vaultFolder) {
            this.vaultFolderId = vaultFolder.folderid;
        } else {
            const created = await this.client.createfolder(this.remoteBaseDir, 0);
            this.vaultFolderId = created.metadata.folderid;
        }
    }
  }

  async walk(): Promise<Entity[]> {
    await this._init();
    const allFiles: Entity[] = [];
    const walkInternal = async (folderId: number, path: string) => {
        const res = await this.client.listfolder(folderId);
        for (const item of res.contents || []) {
            const isFolder = item.isfolder;
            const keyRaw = path + item.name + (isFolder ? "/" : "");
            const entity: Entity = {
                keyRaw,
                key: keyRaw,
                sizeRaw: item.size || 0,
                mtimeSvr: item.modified ? Date.parse(item.modified).valueOf() : Date.now(),
            };
            allFiles.push(entity);
            if (isFolder) await walkInternal(item.folderid, keyRaw);
        }
    };
    await walkInternal(parseInt(this.vaultFolderId), "");
    return allFiles;
  }

  async readFile(key: string): Promise<ArrayBuffer> {
    // TBD: Use pCloud SDK to download
    throw new Error("pCloud readFile not yet implemented");
  }

  async writeFile(key: string, content: ArrayBuffer, mtime: number, ctime: number): Promise<Entity> {
    // TBD: Use pCloud SDK to upload
    throw new Error("pCloud writeFile not yet implemented");
  }

  async rm(key: string): Promise<void> {
    // TBD: Use pCloud SDK to delete
  }

  async mkdir(key: string): Promise<Entity> {
    // TBD: Use pCloud SDK to create folder
    throw new Error("pCloud mkdir not yet implemented");
  }
}

export async function setConfigBySuccessfullAuthInplace(config: PCloudConfig, authAllowFirstRes: any, authRes: any, saveUpdatedConfigFunc: () => Promise<any> | undefined) {
    config.accessToken = authRes.access_token;
    config.hostname = authAllowFirstRes.hostname;
    config.locationid = authAllowFirstRes.locationid;
    config.credentialsShouldBeDeletedAtTimeMs = Date.now() + OAUTH2_FORCE_EXPIRE_MILLISECONDS;
    await saveUpdatedConfigFunc?.();
}
