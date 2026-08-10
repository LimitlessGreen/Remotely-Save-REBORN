import * as path from "path";
import {
  BlobServiceClient,
  ContainerClient,
} from "@azure/storage-blob";
import type { Entity, AzureBlobStorageConfig } from "./baseTypes";
import { FakeFs } from "./fsAll";
import { arrayBufferToHex } from "./misc";

export const simpleTransRemotePrefix = (x: string) => {
  if (x === undefined) return "";
  let y = path.posix.normalize(x.trim());
  if (y === undefined || y === "" || y === "/" || y === ".") return "";
  if (y.startsWith("/")) y = y.slice(1);
  if (!y.endsWith("/")) y = `${y}/`;
  return y;
};

export const DEFAULT_AZUREBLOBSTORAGE_CONFIG: AzureBlobStorageConfig = {
  containerSasUrl: "",
  containerName: "",
  remotePrefix: "",
  generateFolderObject: false,
  partsConcurrency: 5,
  kind: "azureblobstorage",
};

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Azure Blob Storage service
 */

export class FakeFsAzureBlobStorage extends FakeFs {
  kind: "azureblobstorage" = "azureblobstorage";
  config: AzureBlobStorageConfig;
  containerClient: ContainerClient;

  constructor(config: AzureBlobStorageConfig, vaultName: string) {
    super();
    this.config = config;
    const blobServiceClient = new BlobServiceClient(this.config.containerSasUrl);
    this.containerClient = blobServiceClient.getContainerClient(this.config.containerName);
  }

  async walk(): Promise<Entity[]> {
    const allFiles: Entity[] = [];
    const prefix = simpleTransRemotePrefix(this.config.remotePrefix);

    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        const keyRaw = blob.name.slice(prefix.length);
        allFiles.push({
            keyRaw,
            key: keyRaw,
            sizeRaw: blob.properties.contentLength || 0,
            mtimeSvr: blob.properties.lastModified.valueOf(),
            hash: blob.properties.contentMD5 ? arrayBufferToHex(blob.properties.contentMD5.buffer as ArrayBuffer) : undefined
        });
    }
    return allFiles;
  }

  async readFile(key: string): Promise<ArrayBuffer> {
    const blobClient = this.containerClient.getBlobClient(simpleTransRemotePrefix(this.config.remotePrefix) + key);
    const downloadResponse = await blobClient.download();
    return await (await downloadResponse.blobBody!).arrayBuffer();
  }

  async writeFile(key: string, content: ArrayBuffer, mtime: number, ctime: number): Promise<Entity> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(simpleTransRemotePrefix(this.config.remotePrefix) + key);
    await blockBlobClient.upload(content, content.byteLength, {
        metadata: { mtime: new Date(mtime).toISOString() }
    });
    const props = await blockBlobClient.getProperties();
    return {
        keyRaw: key,
        key: key,
        sizeRaw: content.byteLength,
        mtimeSvr: props.lastModified!.valueOf(),
    };
  }

  async rm(key: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(simpleTransRemotePrefix(this.config.remotePrefix) + key);
    await blockBlobClient.delete();
  }

  async mkdir(key: string): Promise<Entity> {
    // Azure Blob Storage doesn't have real folders
    return {
        keyRaw: key,
        key: key,
        sizeRaw: 0,
        mtimeSvr: Date.now(),
    };
  }
}
