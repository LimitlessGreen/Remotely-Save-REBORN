/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Unified OneDrive Provider (Supports both App Folder and Full Drive)
 */

import { OAuth2Handler } from "../../auth/oauth2";
import type {
  Entity,
  OnedriveConfig,
  OnedriveFullConfig,
} from "../../core/baseTypes";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import { OneDriveApiClient } from "./oneDriveClient";

export type OneDriveMode = "app" | "full";

export const ONEDRIVE_AUTHORITY = "https://login.microsoftonline.com/common";
export const ONEDRIVE_CLIENT_ID = "f11a87b8-6447-49f9-bd42-8c17b5f63d04";

export const DEFAULT_ONEDRIVE_CONFIG: OnedriveConfig = {
  accessToken: "",
  clientID: ONEDRIVE_CLIENT_ID ?? "",
  authority: ONEDRIVE_AUTHORITY ?? "",
  refreshToken: "",
  accessTokenExpiresInSeconds: 0,
  accessTokenExpiresAtTime: 0,
  deltaLink: "",
  username: "",
  credentialsShouldBeDeletedAtTime: 0,
  emptyFile: "skip",
  kind: "onedrive",
};

export const DEFAULT_ONEDRIVEFULL_CONFIG: OnedriveFullConfig = {
  accessToken: "",
  clientID: ONEDRIVE_CLIENT_ID ?? "",
  authority: ONEDRIVE_AUTHORITY ?? "",
  refreshToken: "",
  accessTokenExpiresInSeconds: 0,
  accessTokenExpiresAtTime: 0,
  deltaLink: "",
  username: "",
  credentialsShouldBeDeletedAtTime: 0,
  emptyFile: "skip",
  kind: "onedrivefull",
};

export async function getAuthUrlAndVerifier(
  clientID: string,
  authority: string
) {
  const { verifier, challenge } = await OAuth2Handler.generatePkce();
  const oauth = new OAuth2Handler({
    clientId: clientID,
    authEndpoint: `${authority}/oauth2/v2.0/authorize`,
    tokenEndpoint: `${authority}/oauth2/v2.0/token`,
    redirectUri: "obsidian://remotely-save-cb-onedrive", // logic in handler will adjust if needed
    scopes: ["User.Read", "Files.ReadWrite", "offline_access"],
  });
  const authUrl = oauth.getAuthUrl("state", {
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return { authUrl, verifier };
}

export const getShrinkedSettings = (
  config: OnedriveConfig | OnedriveFullConfig
) => {
  const res = JSON.parse(JSON.stringify(config));
  res.accessToken = "";
  res.refreshToken = "";
  return res;
};

class RawOneDriveFs implements RawFs {
  private api: OneDriveApiClient | null = null;
  private rootDrivePath: string;

  constructor(
    private mode: OneDriveMode,
    private config: OnedriveConfig | OnedriveFullConfig,
    _vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    const base =
      mode === "app" ? "/me/drive/special/approot" : "/me/drive/root";
    // We don't include remoteBaseDir here because BaseCloudFs will handle the prefixing
    this.rootDrivePath = base;
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
    const all: Entity[] = [];

    const recurse = async (relPath: string) => {
      const items = await this.api?.listChildren(
        `${this.rootDrivePath}${relPath}`
      );
      if (!items) return;
      for (const item of items) {
        const isDir = !!item.folder;
        const key =
          (relPath ? relPath.slice(1) + "/" : "") +
          item.name +
          (isDir ? "/" : "");
        all.push({
          key,
          keyRaw: key,
          sizeRaw: item.size || 0,
          mtimeSvr: item.lastModifiedDateTime
            ? Date.parse(item.lastModifiedDateTime).valueOf()
            : Date.now(),
          hash: item.file?.hashes?.sha1Hash,
        });
        if (!partial && isDir) await recurse(`${relPath}/${item.name}`);
      }
    };

    // BaseCloudFs passes fullPath which already includes the prefix if applicable.
    // However, OneDrive API expects the path starting from rootDrivePath.
    // In our case, fullPath will be passed as the remote path.
    await recurse(fullPath === "/" ? "" : fullPath.replace(/\/$/, ""));
    return all;
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const item = await this.api?.getItem(
      `${this.rootDrivePath}${fullPath === "/" ? "" : fullPath.replace(/\/$/, "")}`
    );
    if (!item) throw new Error(`Not found: ${fullPath}`);
    const _isDir = !!item.folder;
    return {
      key: fullPath,
      keyRaw: fullPath,
      sizeRaw: item.size || 0,
      mtimeSvr: item.lastModifiedDateTime
        ? Date.parse(item.lastModifiedDateTime).valueOf()
        : Date.now(),
      hash: item.file?.hashes?.sha1Hash,
      versionId: item.id, // OneDrive has IDs, but for "versioning" we might need something else later
    };
  }

  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    const item = await this.api?.getItem(`${this.rootDrivePath}${fullPath}`);
    if (!item) throw new Error(`Not found: ${fullPath}`);
    const downloadUrl = item["@microsoft.graph.downloadUrl"];
    if (!downloadUrl) {
      throw new Error(`Download URL missing for ${fullPath}`);
    }
    const data = await this.api?.download(downloadUrl);
    if (!data) throw new Error(`Could not download ${fullPath}`);
    return data;
  }

  async writeFile(fullPath: string, content: ArrayBuffer): Promise<Entity> {
    await this.ensureInited();
    const item = await this.api?.upload(
      `${this.rootDrivePath}${fullPath}`,
      content
    );
    if (!item) throw new Error(`Could not upload to ${fullPath}`);
    return {
      key: fullPath,
      keyRaw: fullPath,
      sizeRaw: item.size || 0,
      mtimeSvr: item.lastModifiedDateTime
        ? Date.parse(item.lastModifiedDateTime).valueOf()
        : Date.now(),
      hash: item.file?.hashes?.sha1Hash,
      versionId: item.id,
    };
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    await this.api?.delete(`${this.rootDrivePath}${fullPath}`);
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const normalized = fullPath.replace(/\/$/, "");
    const parts = normalized.split("/");
    const name = parts.pop();
    if (name === undefined) {
      throw new Error(`Invalid path: ${fullPath}`);
    }
    const parentPath = parts.join("/");
    const parentDrivePath = `${this.rootDrivePath}${parentPath ? "/" + parentPath : ""}`;

    const item = await this.api?.createFolder(parentDrivePath, name);
    if (!item) throw new Error(`Could not create folder ${fullPath}`);
    return {
      key: fullPath,
      keyRaw: fullPath,
      sizeRaw: 0,
      mtimeSvr: item.lastModifiedDateTime
        ? Date.parse(item.lastModifiedDateTime).valueOf()
        : Date.now(),
    };
  }

  async getUserDisplayName(): Promise<string> {
    await this.ensureInited();
    const info = await this.api?.getUserInfo();
    if (!info) return "Unknown User";
    return info.displayName || "Unknown User";
  }

  private async ensureInited() {
    if (this.api) return;

    const oauth = new OAuth2Handler({
      clientId: this.config.clientID || ONEDRIVE_CLIENT_ID,
      authEndpoint: `${this.config.authority}/oauth2/v2.0/authorize`,
      tokenEndpoint: `${this.config.authority}/oauth2/v2.0/token`,
      redirectUri: `obsidian://remotely-save-cb${this.mode === "full" ? "-onedrivefull" : "-onedrive"}`,
      scopes:
        this.mode === "app"
          ? ["User.Read", "Files.ReadWrite.AppFolder", "offline_access"]
          : ["User.Read", "Files.ReadWrite", "offline_access"],
    });

    if (Date.now() >= this.config.accessTokenExpiresAtTime) {
      const res = await oauth.refreshToken(this.config.refreshToken);
      this.config.accessToken = res.access_token;
      this.config.accessTokenExpiresAtTime =
        Date.now() + res.expires_in * 1000 - 300000;
      await this.onConfigUpdate();
    }

    this.api = new OneDriveApiClient(this.config.accessToken);
  }

  async checkConnect(fullPath: string): Promise<boolean> {
    await this.ensureInited();
    await this.api?.listChildren(
      `${this.rootDrivePath}${fullPath === "/" ? "" : fullPath.replace(/\/$/, "")}`
    );
    return true;
  }
}

export class OneDriveFileSystem extends BaseCloudFs {
  constructor(
    mode: OneDriveMode,
    config: OnedriveConfig | OnedriveFullConfig,
    vaultName: string,
    onConfigUpdate: () => Promise<void>
  ) {
    super(
      mode === "app" ? "onedrive" : "onedrivefull",
      new RawOneDriveFs(mode, config, vaultName, onConfigUpdate),
      config.remoteBaseDir || vaultName
    );
  }

  async checkConnect(callbackFunc?: (err?: unknown) => void): Promise<boolean> {
    try {
      await (this.rawFs as RawOneDriveFs).checkConnect(this.toFullPath(""));
    } catch (err: unknown) {
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }

  async getUserDisplayName(): Promise<string> {
    return await (this.rawFs as RawOneDriveFs).getUserDisplayName();
  }
}
