import { nanoid } from "nanoid";
import {
  type Entity,
  KOOFR_CLIENT_ID,
  KOOFR_CLIENT_SECRET,
  type KoofrConfig,
  COMMAND_CALLBACK_KOOFR,
} from "./baseTypes";
import { FakeFs } from "./fsAll";

export const DEFAULT_KOOFR_CONFIG: KoofrConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  scope: "",
  api: "https://app.koofr.net",
  mountID: "",
  kind: "koofr",
};

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Koofr storage service
 */

export const generateAuthUrl = (apiAddr: string, hasCallback: boolean) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: KOOFR_CLIENT_ID ?? "",
    scope: "public",
    state: nanoid(),
  });
  if (hasCallback) params.set("redirect_uri", `obsidian://${COMMAND_CALLBACK_KOOFR}`);
  else params.set("redirect_uri", "urn:ietf:wg:oauth:2.0:oob");
  return `${apiAddr}/oauth2/auth?${params}`;
};

export const sendAuthReq = async (apiAddr: string, authCode: string, errorCallBack: any, hasCallback: boolean) => {
  try {
    const params = new URLSearchParams({
      code: authCode,
      grant_type: "authorization_code",
      client_id: KOOFR_CLIENT_ID ?? "",
      client_secret: KOOFR_CLIENT_SECRET ?? "",
      redirect_uri: hasCallback ? `obsidian://${COMMAND_CALLBACK_KOOFR}` : "urn:ietf:wg:oauth:2.0:oob",
    });
    const resp = await fetch(`${apiAddr}/oauth2/token`, {
      method: "POST",
      body: params,
    });
    return await resp.json();
  } catch (e) {
    console.error(e);
    if (errorCallBack) await errorCallBack(e);
  }
};

export const sendRefreshTokenReq = async (apiAddr: string, refreshToken: string) => {
  const params = new URLSearchParams({
    client_id: KOOFR_CLIENT_ID ?? "",
    client_secret: KOOFR_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`${apiAddr}/oauth2/token`, {
    method: "POST",
    body: params,
  });
  return await res.json();
};

export class FakeFsKoofr extends FakeFs {
  kind: "koofr" = "koofr";
  config: KoofrConfig;
  remoteBaseDir: string;
  saveUpdatedConfigFunc: () => Promise<any>;

  constructor(
    config: KoofrConfig,
    vaultName: string,
    saveUpdatedConfigFunc: () => Promise<any>
  ) {
    super();
    this.config = config;
    this.remoteBaseDir = config.remoteBaseDir || vaultName;
    this.saveUpdatedConfigFunc = saveUpdatedConfigFunc;
  }

  async _init() {
    if (Date.now() > this.config.accessTokenExpiresAtTimeMs) {
        const res = await sendRefreshTokenReq(this.config.api, this.config.refreshToken);
        this.config.accessToken = res.access_token;
        this.config.accessTokenExpiresInMs = res.expires_in * 1000;
        this.config.accessTokenExpiresAtTimeMs = Date.now() + res.expires_in * 1000 - 60 * 5 * 1000;
        await this.saveUpdatedConfigFunc();
    }
  }

  async walk(): Promise<Entity[]> {
    await this._init();
    // TBD: Use Koofr API to list files
    throw new Error("Koofr walk not yet implemented");
  }

  async readFile(key: string): Promise<ArrayBuffer> {
    throw new Error("Koofr readFile not yet implemented");
  }

  async writeFile(key: string, content: ArrayBuffer, mtime: number, ctime: number): Promise<Entity> {
    throw new Error("Koofr writeFile not yet implemented");
  }

  async rm(key: string): Promise<void> {
  }

  async mkdir(key: string): Promise<Entity> {
    throw new Error("Koofr mkdir not yet implemented");
  }
}

export async function setConfigBySuccessfullAuthInplace(config: KoofrConfig, authRes: any, saveUpdatedConfigFunc: () => Promise<any> | undefined) {
    config.accessToken = authRes.access_token;
    config.refreshToken = authRes.refresh_token;
    config.accessTokenExpiresInMs = authRes.expires_in * 1000;
    config.accessTokenExpiresAtTimeMs = Date.now() + authRes.expires_in * 1000 - 60 * 5 * 1000;
    await saveUpdatedConfigFunc?.();
}
