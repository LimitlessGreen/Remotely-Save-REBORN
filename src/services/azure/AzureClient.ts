/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Pure API Client for Azure Blob Storage
 */

import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

export class AzureClient {
  private containerClient: ContainerClient;

  constructor(sasUrl: string, containerName: string) {
    const blobServiceClient = new BlobServiceClient(sasUrl);
    this.containerClient = blobServiceClient.getContainerClient(containerName);
  }

  public async listBlobs(prefix: string) {
    return this.containerClient.listBlobsFlat({ prefix });
  }

  public async downloadBlob(name: string): Promise<ArrayBuffer> {
    const blobClient = this.containerClient.getBlobClient(name);
    const res = await blobClient.download();
    return await (await res.blobBody!).arrayBuffer();
  }

  public async uploadBlob(name: string, content: ArrayBuffer, mtime: number) {
    const blockBlobClient = this.containerClient.getBlockBlobClient(name);
    await blockBlobClient.upload(content, content.byteLength, {
      metadata: { mtime: new Date(mtime).toISOString() }
    });
    return await blockBlobClient.getProperties();
  }

  public async deleteBlob(name: string) {
    await this.containerClient.getBlockBlobClient(name).delete();
  }

  public async checkConnect() {
    await this.containerClient.getProperties();
    return true;
  }
}
