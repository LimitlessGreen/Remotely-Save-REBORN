/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * FakeFs Provider for Azure Blob Storage
 */

import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import {
  type Entity,
  type AzureBlobStorageConfig,
} from "../../core/baseTypes";
import { AzureClient } from "./AzureClient";
import { arrayBufferToHex } from "../../utils/misc";

export const DEFAULT_AZUREBLOBSTORAGE_CONFIG: AzureBlobStorageConfig = {
  containerSasUrl: "",
  containerName: "",
  remotePrefix: "",
  generateFolderObject: false,
  partsConcurrency: 5,
  kind: "azureblobstorage",
};

class RawAzureFs implements RawFs {
  private api: AzureClient;

  constructor(config: AzureBlobStorageConfig) {
    this.api = new AzureClient(config.containerSasUrl, config.containerName);
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    const list: Entity[] = [];
    // partial is ignored here as Azure SDK doesn't easily support MaxKeys in listBlobsFlat for simplicity
    for await (const blob of await this.api.listBlobs(fullPath)) {
      list.push({
        key: blob.name,
        keyRaw: blob.name,
        sizeRaw: blob.properties.contentLength || 0,
        mtimeSvr: blob.properties.lastModified.valueOf(),
        hash: blob.properties.contentMD5 ? arrayBufferToHex(blob.properties.contentMD5.buffer as ArrayBuffer) : undefined
      });
    }
    return list;
  }

  async stat(fullPath: string): Promise<Entity> {
    // Basic implementation via walk or direct call if available
    const all = await this.walk(fullPath, true);
    const found = all.find(e => e.key === fullPath);
    if (!found) throw new Error(`Not found: ${fullPath}`);
    return found;
  }

  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    return await this.api.downloadBlob(fullPath);
  }

  async writeFile(fullPath: string, content: ArrayBuffer, mtime: number, _ctime: number): Promise<Entity> {
    const props = await this.api.uploadBlob(fullPath, content, mtime);
    return {
      key: fullPath,
      keyRaw: fullPath,
      sizeRaw: content.byteLength,
      mtimeSvr: props.lastModified!.valueOf(),
    };
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.api.deleteBlob(fullPath);
  }

  async mkdir(fullPath: string): Promise<Entity> {
    // Virtual folders only
    return { key: fullPath, keyRaw: fullPath, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  async checkConnect() {
    return await this.api.checkConnect();
  }
}

export class AzureFileSystem extends BaseCloudFs {
  constructor(config: AzureBlobStorageConfig, vaultName: string) {
    super("azureblobstorage", new RawAzureFs(config), config.remotePrefix || `${vaultName}/`);
  }

  async checkConnect(callbackFunc?: any): Promise<boolean> {
    try {
      const ok = await (this.rawFs as RawAzureFs).checkConnect();
      if (!ok) throw Error("Connection failed");
    } catch (err: any) {
      console.debug(err);
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
