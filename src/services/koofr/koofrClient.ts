/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Pure API Client for Koofr
 */

export class KoofrApiClient {
  constructor(
    private accessToken: string,
    private apiBase: string
  ) {}

  public async listItems(mountId: string, path: string) {
    const res = await this.request(
      `${this.apiBase}/api/v2/mounts/${mountId}/files/list?path=${encodeURIComponent(path)}`
    );
    return await res.json();
  }

  public async downloadFile(
    mountId: string,
    path: string
  ): Promise<ArrayBuffer> {
    const res = await this.request(
      `${this.apiBase}/api/v2/mounts/${mountId}/files/get?path=${encodeURIComponent(path)}`
    );
    return await res.arrayBuffer();
  }

  public async uploadFile(mountId: string, path: string, content: ArrayBuffer) {
    const res = await this.request(
      `${this.apiBase}/api/v2/mounts/${mountId}/files/put?path=${encodeURIComponent(path)}`,
      {
        method: "PUT",
        body: content,
      }
    );
    return res;
  }

  public async createFolder(mountId: string, path: string) {
    await this.request(
      `${this.apiBase}/api/v2/mounts/${mountId}/files/mkdir?path=${encodeURIComponent(path)}`,
      { method: "POST" }
    );
  }

  public async delete(mountId: string, path: string) {
    await this.request(
      `${this.apiBase}/api/v2/mounts/${mountId}/files/remove?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    );
  }

  private async request(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) throw new Error(`Koofr API Error: ${res.status}`);
    return res;
  }
}
