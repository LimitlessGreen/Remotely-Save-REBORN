/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Pure API Client for pCloud
 */

import pcloudSdk from "pcloud-sdk-js";

export class PCloudApiClient {
  private client: any;

  constructor(accessToken: string, locationId: number) {
    this.client = pcloudSdk.createClient(accessToken, locationId as any);
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

  public async downloadFile(path: string, revisionId?: string): Promise<ArrayBuffer> {
    const options: any = {};
    if (revisionId) {
      options.revisionid = revisionId;
    }

    // pCloud downloadfile returns a link (hosts + path)
    const res = await this.client.downloadfile(0, path, options);
    if (res.result !== 0) {
      throw new Error(`pCloud download error: ${res.error || res.result}`);
    }

    const downloadUrl = `https://${res.hosts[0]}${res.path}`;
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download from pCloud link: ${downloadRes.statusText}`);
    }
    return await downloadRes.arrayBuffer();
  }

  public async listRevisions(path: string) {
    return await this.client.listrevisions(0, path);
  }

  public async deleteFile(path: string) {
    await this.client.deletefile(0, path);
  }
}
