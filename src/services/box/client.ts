/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Pure API Client for Box
 */

import { BoxClient } from "box-typescript-sdk-gen/lib/client.generated";

export class BoxApiClient {
  private client: BoxClient;

  constructor(accessToken: string) {
    this.client = new BoxClient({
      auth: { retrieveToken: async () => ({ accessToken }) } as any
    });
  }

  public async listItems(folderId: string) {
    return await this.client.folders.getFolderItems(folderId);
  }

  public async getFolderByName(parentId: string, name: string) {
    const items = await this.listItems(parentId);
    return items.entries?.find(i => i.name === name && i.type === "folder");
  }

  public async createFolder(parentId: string, name: string) {
    return await this.client.folders.createFolder({ name, parent: { id: parentId } });
  }

  public async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const stream = await this.client.downloads.downloadFile(fileId);
    return await new Response(stream as any).arrayBuffer();
  }

  public async uploadFile(parentId: string, name: string, content: ArrayBuffer, mtime: number) {
    return await this.client.uploads.uploadFile({
      name,
      parent: { id: parentId },
      attributes: { content_modified_at: new Date(mtime).toISOString() }
    }, content as any);
  }

  public async updateFile(fileId: string, content: ArrayBuffer) {
    return await this.client.uploads.uploadFileContent(fileId, content as any);
  }

  public async deleteFile(fileId: string) {
    await this.client.files.deleteFileById(fileId);
  }
}
