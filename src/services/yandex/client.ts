/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Pure API Client for Yandex Disk
 */

const API_BASE = "https://cloud-api.yandex.net/v1/disk/resources";

export interface YandexResource {
  name: string;
  type: "dir" | "file";
  size?: number;
  modified?: string;
  path?: string;
  _embedded?: {
    items: YandexResource[];
  };
}

export class YandexDiskApiClient {
  constructor(private accessToken: string) {}

  public async getResource(path: string): Promise<YandexResource> {
    const res = await this.request(API_BASE + `?path=${encodeURIComponent(path)}`);
    return await res.json();
  }

  public async mkdir(path: string) {
    await this.request(API_BASE + `?path=${encodeURIComponent(path)}`, { method: "PUT" });
  }

  public async delete(path: string) {
    await this.request(API_BASE + `?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  }

  public async getUploadLink(path: string, overwrite = false) {
    const res = await this.request(API_BASE + `/upload?path=${encodeURIComponent(path)}&overwrite=${overwrite}`);
    return await res.json();
  }

  public async getDownloadLink(path: string) {
    const res = await this.request(API_BASE + `/download?path=${encodeURIComponent(path)}`);
    return await res.json();
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `OAuth ${this.accessToken}`);
    const res = await fetch(url, { ...init, headers });
    if (res.status === 204) return res;
    if (!res.ok) throw new Error(`Yandex API Error: ${res.status}`);
    return res;
  }
}
