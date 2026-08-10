/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Yandex Disk API wrapper
 */

export interface Resource {
  name?: string;
  created?: string;
  modified?: string;
  path?: string;
  md5?: string;
  type?: "dir" | "file";
  size?: number;
  _embedded?: {
    items: Resource[];
  };
}

export class YandexApi {
  accessToken: string;
  host = "https://cloud-api.yandex.net/v1";

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async _api(method: string, endpoint: string, query?: Record<string, string>, body?: any) {
    const url = new URL(`${this.host}/${endpoint}`);
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      method,
      headers: { Authorization: `OAuth ${this.accessToken}` },
      body
    });
    if (res.status === 204) return null;
    return await res.json();
  }

  async getResource(path: string): Promise<Resource> {
    return await this._api("GET", "disk/resources", { path });
  }

  async mkdir(path: string) {
    return await this._api("PUT", "disk/resources", { path });
  }

  async delete(path: string) {
    return await this._api("DELETE", "disk/resources", { path });
  }

  async getUploadLink(path: string, overwrite = false) {
    return await this._api("GET", "disk/resources/upload", { path, overwrite: overwrite.toString() });
  }

  async getDownloadLink(path: string) {
    return await this._api("GET", "disk/resources/download", { path });
  }
}
