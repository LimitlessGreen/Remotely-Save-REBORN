/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Pure API Client for Google Drive v3
 */

const BASE_URL = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  modifiedTime?: string;
}

export class GoogleDriveApiClient {
  constructor(private accessToken: string) {}

  public async listFiles(query: string, fields: string): Promise<{ files: GDriveFile[], nextPageToken?: string }> {
    const url = new URL(BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("fields", fields);
    url.searchParams.set("pageSize", "1000");

    const res = await this.request(url.toString());
    return await res.json();
  }

  public async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const res = await this.request(`${BASE_URL}/${fileId}?alt=media`);
    return await res.arrayBuffer();
  }

  public async uploadFile(metadata: object, media: Blob, fileId?: string): Promise<GDriveFile> {
    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("media", media);

    const url = new URL(fileId ? `${UPLOAD_URL}/${fileId}` : UPLOAD_URL);
    url.searchParams.set("uploadType", "multipart");
    url.searchParams.set("fields", "id,name,mimeType,size,md5Checksum,modifiedTime");

    const res = await this.request(url.toString(), {
      method: fileId ? "PATCH" : "POST",
      body: formData,
    });
    return await res.json();
  }

  public async deleteFile(fileId: string): Promise<void> {
    await this.request(`${BASE_URL}/${fileId}`, { method: "DELETE" });
  }

  public async createFolder(name: string, parents?: string[]): Promise<GDriveFile> {
    const res = await this.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents
      })
    });
    return await res.json();
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) throw new Error(`GDrive API Error: ${res.status}`);
    return res;
  }
}
