/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Pure API Client for pCloud
 */

import pcloudSdk from "pcloud-sdk-js";

export class PCloudApiClient {
  private client: any;

  constructor(accessToken: string, locationId: number) {
    this.client = pcloudSdk.createClient(accessToken, locationId);
  }

  public async listFolder(folderId: number) {
    return await this.client.listfolder(folderId);
  }

  public async createFolder(name: string, parentId: number) {
    return await this.client.createfolder(name, parentId);
  }

  public async uploadFile(name: string, parentId: number, content: ArrayBuffer) {
    return await this.client.upload(content, parentId, name);
  }

  public async downloadFile(path: string): Promise<ArrayBuffer> {
    const data = await this.client.downloadfile(0, path);
    return await new Response(data as any).arrayBuffer();
  }

  public async deleteFile(path: string) {
    await this.client.deletefile(0, path);
  }
}
