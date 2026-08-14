import { type App, Notice } from "obsidian";
import { OAuth2Handler } from "../../auth/oauth2";
import {
  COMMAND_CALLBACK_ONEDRIVE,
  COMMAND_CALLBACK_ONEDRIVEFULL,
} from "../../core/baseTypes";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { ONEDRIVE_CLIENT_ID, OneDriveFileSystem } from "./OneDriveFileSystem";
import { OneDriveSettings } from "./OneDriveSettings";

export const OneDriveService: CloudService = {
  id: "onedrive",
  callbackId: COMMAND_CALLBACK_ONEDRIVE,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    const isFull = plugin.settings.serviceType === "onedrivefull";
    return new OneDriveFileSystem(
      isFull ? "full" : "app",
      isFull ? plugin.settings.onedrivefull : plugin.settings.onedrive,
      app.vault.getName(),
      () => plugin.saveSettings()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new OneDriveSettings(plugin, app, t);
  },

  async handleCallback(
    plugin: RemotelySavePlugin,
    params: Record<string, string>
  ) {
    const isFull = plugin.settings.serviceType === "onedrivefull";
    const config = isFull
      ? plugin.settings.onedrivefull
      : plugin.settings.onedrive;

    const oauth = new OAuth2Handler({
      clientId: config.clientID || ONEDRIVE_CLIENT_ID,
      authEndpoint: `${config.authority}/oauth2/v2.0/authorize`,
      tokenEndpoint: `${config.authority}/oauth2/v2.0/token`,
      redirectUri: `obsidian://${isFull ? COMMAND_CALLBACK_ONEDRIVEFULL : COMMAND_CALLBACK_ONEDRIVE}`,
      scopes: isFull
        ? ["User.Read", "Files.ReadWrite", "offline_access"]
        : ["User.Read", "Files.ReadWrite.AppFolder", "offline_access"],
    });

    const tokens = await oauth.exchangeCode(
      params.code,
      plugin.oauth2Info.verifier
    );
    config.accessToken = tokens.access_token;
    config.refreshToken = tokens.refresh_token ?? "";
    config.accessTokenExpiresAtTime =
      Date.now() + tokens.expires_in * 1000 - 300000;

    await plugin.saveSettings();
    new Notice("OneDrive connected!");
  },
};
