/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Koofr Provider using BaseCloudFs
 */

import { OAuth2Handler } from "../../auth/oauth2";
import {
  type Entity,
  KOOFR_CLIENT_ID,
  KOOFR_CLIENT_SECRET,
  type KoofrConfig,
} from "../../core/baseTypes";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import { KoofrApiClient } from "./koofrClient";

export const DEFAULT_KOOFR_CONFIG: KoofrConfig = {
  accessToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  refreshToken: "",
  remoteBaseDir: "",
  credentialsShouldBeDeletedAtTimeMs: 0,
  scope: "",
  api: "https://app.koofr.net",
  mountID: "",
  kind: "koofr",
};

export const generateAuthUrl = (api: string, hasCallback: boolean) => {
  const clientID = KOOFR_CLIENT_ID ?? "";
  const redirectUri = hasCallback
    ? "obsidian://remotely-save-cb-koofr"
    : "urn:ietf:wg:oauth:2.0:oob";
  return `${api}/oauth2/auth?response_type=code&client_id=${clientID}&redirect_uri=${redirectUri}&scope=read+write`;
};

class RawKoofrFs implements RawFs {
  private api: KoofrApiClient | null = null;
  private rootPath: string;

  constructor(
    private config: KoofrConfig,
    vaultName: string,
    private onConfigUpdate: () => Promise<void>
  ) {
    this.rootPath = config.remoteBaseDir || vaultName;
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
    const list: Entity[] = [];

    const scan = async (currentPath: string, relBase: string) => {
      const data = await this.api?.listItems(this.config.mountID, currentPath);
      for (const item of data.files || []) {
        const isDir = item.type === "dir";
        const key = relBase + item.name + (isDir ? "/" : "");
        list.push({
          key,
          keyRaw: key,
          sizeRaw: item.size || 0,
          mtimeSvr: item.modified || Date.now(),
        });
        if (!partial && isDir) await scan(`${currentPath}/${item.name}`, key);
      }
    };

    // fullPath passed here is relative to root.
    // Koofr API uses paths on the mount.
    await scan(
      `/${this.rootPath}${fullPath === "/" ? "" : fullPath}`,
      fullPath === "/" ? "" : fullPath.replace(/\/$/, "") + "/"
    );
    return list;
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    // Koofr listItems can give info about items in a folder.
    const parentPath =
      fullPath.substring(0, fullPath.lastIndexOf("/") + 1) || "/";
    const data = await this.api?.listItems(
      this.config.mountID,
      `/${this.rootPath}${parentPath}`
    );
    const nameParts = fullPath.replace(/\/$/, "").split("/");
    const name = nameParts.pop();
    if (name === undefined) {
      throw new Error(`Invalid path: ${fullPath}`);
    }
    const item = data.files?.find((i: { name: string }) => i.name === name);
    if (!item) throw new Error(`Not found: ${fullPath}`);

    const _isDir = item.type === "dir";
    return {
      key: fullPath,
      keyRaw: fullPath,
      sizeRaw: item.size || 0,
      mtimeSvr: item.modified || Date.now(),
    };
  }

  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    const data = await this.api?.downloadFile(
      this.config.mountID,
      `/${this.rootPath}${fullPath}`
    );
    if (!data) throw new Error(`Could not download ${fullPath}`);
    return data;
  }

  async writeFile(
    fullPath: string,
    content: ArrayBuffer,
    _mtime: number,
    _ctime: number
  ): Promise<Entity> {
    await this.ensureInited();
    await this.api?.uploadFile(
      this.config.mountID,
      `/${this.rootPath}${fullPath}`,
      content
    );
    return {
      key: fullPath,
      keyRaw: fullPath,
      sizeRaw: content.byteLength,
      mtimeSvr: Date.now(),
    };
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    await this.api?.delete(this.config.mountID, `/${this.rootPath}${fullPath}`);
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    await this.api?.createFolder(
      this.config.mountID,
      `/${this.rootPath}${fullPath}`
    );
    return {
      key: fullPath,
      keyRaw: fullPath,
      sizeRaw: 0,
      mtimeSvr: Date.now(),
    };
  }

  private async ensureInited() {
    if (this.api) return;

    const oauth = new OAuth2Handler({
      clientId: KOOFR_CLIENT_ID,
      clientSecret: KOOFR_CLIENT_SECRET,
      authEndpoint: `${this.config.api}/oauth2/auth`,
      tokenEndpoint: `${this.config.api}/oauth2/token`,
      redirectUri: "obsidian://remotely-save-cb-koofr",
      scopes: ["public"],
    });

    if (Date.now() >= this.config.accessTokenExpiresAtTimeMs) {
      const res = await oauth.refreshToken(this.config.refreshToken);
      this.config.accessToken = res.access_token;
      this.config.accessTokenExpiresAtTimeMs =
        Date.now() + res.expires_in * 1000 - 300000;
      await this.onConfigUpdate();
    }

    this.api = new KoofrApiClient(this.config.accessToken, this.config.api);

    // Ensure root exists
    try {
      await this.api.createFolder(this.config.mountID, `/${this.rootPath}`);
    } catch {
      /* ignore if exists */
    }
  }

  async checkConnect(fullPath: string): Promise<boolean> {
    await this.ensureInited();
    await this.api?.listItems(
      this.config.mountID,
      `/${this.rootPath}${fullPath === "/" ? "" : fullPath.replace(/\/$/, "")}`
    );
    return true;
  }
}

export class KoofrFileSystem extends BaseCloudFs {
  constructor(
    config: KoofrConfig,
    vaultName: string,
    onConfigUpdate: () => Promise<void>
  ) {
    super(
      "koofr",
      new RawKoofrFs(config, vaultName, onConfigUpdate),
      config.remoteBaseDir || vaultName
    );
  }

  async checkConnect(callbackFunc?: (err?: unknown) => void): Promise<boolean> {
    try {
      await (this.rawFs as RawKoofrFs).checkConnect(this.toFullPath(""));
    } catch (err: unknown) {
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
