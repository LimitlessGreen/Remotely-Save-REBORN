/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Unified OneDrive Provider (Supports both App Folder and Full Drive)
 */

import { FakeFs } from "../../fsAll";
import { type Entity, type OnedriveConfig, type OnedriveFullConfig, ONEDRIVE_AUTHORITY, ONEDRIVE_CLIENT_ID } from "../../baseTypes";
import { OneDriveApiClient } from "./client";
import { OAuth2Handler } from "../../auth/oauth2";

export type OneDriveMode = "app" | "full";

export class OneDriveProvider extends FakeFs {
  kind: "onedrive" | "onedrivefull";
  private api: OneDriveApiClient | null = null;
  private rootDrivePath: string;

  constructor(
    private mode: OneDriveMode,
    private config: OnedriveConfig | OnedriveFullConfig,
    private vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    super();
    this.kind = mode === "app" ? "onedrive" : "onedrivefull";
    // Construct the drive-specific root path
    const base = mode === "app" ? "/me/drive/special/approot" : "/me/drive/root";
    this.rootDrivePath = `${base}:/${config.remoteBaseDir || vaultName}`;
  }

  async walk(): Promise<Entity[]> {
    await this.init();
    const all: Entity[] = [];

    const recurse = async (relPath: string) => {
      const items = await this.api!.listChildren(`${this.rootDrivePath}${relPath}`);
      for (const item of items) {
        const isDir = !!item.folder;
        const key = (relPath ? relPath.slice(1) + "/" : "") + item.name + (isDir ? "/" : "");
        all.push({
          key, keyRaw: key,
          sizeRaw: item.size || 0,
          mtimeSvr: Date.parse(item.lastModifiedDateTime).valueOf(),
          hash: item.file?.hashes?.sha1Hash
        });
        if (isDir) await recurse(`${relPath}/${item.name}`);
      }
    };

    await recurse("");
    return all;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    await this.init();
    const item = await this.api!.getItem(`${this.rootDrivePath}/${path}`);
    return await this.api!.download(item["@microsoft.graph.downloadUrl"]!);
  }

  async writeFile(path: string, content: ArrayBuffer): Promise<Entity> {
    await this.init();
    const item = await this.api!.upload(`${this.rootDrivePath}/${path}`, content);
    return {
      key: path, keyRaw: path,
      sizeRaw: item.size || 0,
      mtimeSvr: Date.parse(item.lastModifiedDateTime).valueOf(),
      hash: item.file?.hashes?.sha1Hash
    };
  }

  async rm(path: string): Promise<void> {
    await this.init();
    await this.api!.delete(`${this.rootDrivePath}/${path}`);
  }

  async mkdir(path: string): Promise<Entity> {
    await this.init();
    const parts = path.replace(/\/$/, "").split("/");
    const name = parts.pop()!;
    const parent = parts.length > 0 ? `${this.rootDrivePath}/${parts.join("/")}` : this.rootDrivePath;

    const item = await this.api!.createFolder(parent, name);
    return {
      key: path, keyRaw: path,
      sizeRaw: 0,
      mtimeSvr: Date.parse(item.lastModifiedDateTime).valueOf()
    };
  }

  async getUserDisplayName(): Promise<string> {
    await this.init();
    const info = await this.api!.getUserInfo();
    return info.displayName;
  }

  private async init() {
    if (this.api) return;

    const oauth = new OAuth2Handler({
      clientId: this.config.clientID || ONEDRIVE_CLIENT_ID,
      authEndpoint: `${this.config.authority}/oauth2/v2.0/authorize`,
      tokenEndpoint: `${this.config.authority}/oauth2/v2.0/token`,
      redirectUri: `obsidian://remotely-save-cb${this.mode === 'full' ? '-onedrivefull' : '-onedrive'}`,
      scopes: this.mode === 'app' ? ["User.Read", "Files.ReadWrite.AppFolder", "offline_access"] : ["User.Read", "Files.ReadWrite", "offline_access"]
    });

    if (Date.now() >= this.config.accessTokenExpiresAtTime) {
      const res = await oauth.refreshToken(this.config.refreshToken);
      this.config.accessToken = res.access_token;
      this.config.accessTokenExpiresAtTime = Date.now() + (res.expires_in * 1000) - 300000;
      await this.onConfigUpdate();
    }

    this.api = new OneDriveApiClient(this.config.accessToken);
  }
}
