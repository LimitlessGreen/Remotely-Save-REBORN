/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * FakeFs Provider for Azure Blob Storage
 */

import { FakeFs } from "../../fsAll";
import { type Entity, type AzureBlobStorageConfig } from "../../baseTypes";
import { AzureBlobApiClient } from "./client";
import { arrayBufferToHex } from "../../misc";

export class AzureBlobProvider extends FakeFs {
  kind: "azureblobstorage" = "azureblobstorage";
  private api: AzureBlobApiClient;
  private prefix: string;

  constructor(
    private config: AzureBlobStorageConfig,
    private vaultName: string
  ) {
    super();
    this.api = new AzureBlobApiClient(config.containerSasUrl, config.containerName);
    this.prefix = config.remotePrefix || `${vaultName}/`;
    if (!this.prefix.endsWith("/")) this.prefix += "/";
  }

  async walk(): Promise<Entity[]> {
    const list: Entity[] = [];
    for await (const blob of await this.api.listBlobs(this.prefix)) {
      const key = blob.name.slice(this.prefix.length);
      list.push({
        key, keyRaw: key,
        sizeRaw: blob.properties.contentLength || 0,
        mtimeSvr: blob.properties.lastModified.valueOf(),
        hash: blob.properties.contentMD5 ? arrayBufferToHex(blob.properties.contentMD5.buffer as ArrayBuffer) : undefined
      });
    }
    return list;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    return await this.api.downloadBlob(this.prefix + path);
  }

  async writeFile(path: string, content: ArrayBuffer, mtime: number): Promise<Entity> {
    const props = await this.api.uploadBlob(this.prefix + path, content, mtime);
    return {
      key: path, keyRaw: path,
      sizeRaw: content.byteLength,
      mtimeSvr: props.lastModified!.valueOf(),
    };
  }

  async rm(path: string): Promise<void> {
    await this.api.deleteBlob(this.prefix + path);
  }

  async mkdir(path: string): Promise<Entity> {
    // Virtual folders only
    return { key: path, keyRaw: path, sizeRaw: 0, mtimeSvr: Date.now() };
  }
}
