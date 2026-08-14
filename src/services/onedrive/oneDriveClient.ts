/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Microsoft Graph API Client for OneDrive
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface OneDriveItem {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  file?: {
    hashes?: {
      sha1Hash?: string;
    };
  };
  folder?: object;
  "@microsoft.graph.downloadUrl"?: string;
}

export class OneDriveApiClient {
  constructor(private accessToken: string) {}

  public async listChildren(drivePath: string): Promise<OneDriveItem[]> {
    const url = `${GRAPH_BASE}${drivePath}:/children`;
    const res = await this.request(url);
    const data = await res.json();
    return data.value || [];
  }

  public async getItem(drivePath: string): Promise<OneDriveItem> {
    const res = await this.request(`${GRAPH_BASE}${drivePath}`);
    return await res.json();
  }

  public async download(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return await res.arrayBuffer();
  }

  public async upload(
    drivePath: string,
    content: ArrayBuffer
  ): Promise<OneDriveItem> {
    const url = `${GRAPH_BASE}${drivePath}:/content`;
    const res = await this.request(url, {
      method: "PUT",
      body: content,
    });
    return await res.json();
  }

  public async createFolder(
    parentDrivePath: string,
    name: string
  ): Promise<OneDriveItem> {
    const url = `${GRAPH_BASE}${parentDrivePath}:/children`;
    const res = await this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "replace",
      }),
    });
    return await res.json();
  }

  public async delete(drivePath: string): Promise<void> {
    await this.request(`${GRAPH_BASE}${drivePath}`, { method: "DELETE" });
  }

  public async getUserInfo(): Promise<{ displayName: string }> {
    const res = await this.request(`${GRAPH_BASE}/me?$select=displayName`);
    return await res.json();
  }

  private async request(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OneDrive API Error (${res.status}): ${err}`);
    }
    return res;
  }
}
