import { type App, Notice } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { OneDriveProvider } from "./provider";
import { OneDriveSettings } from "./settings";
import type { CloudService } from "../serviceInterface";
import { COMMAND_CALLBACK_ONEDRIVE, COMMAND_CALLBACK_ONEDRIVEFULL, ONEDRIVE_AUTHORITY, ONEDRIVE_CLIENT_ID } from "../../core/baseTypes";
import { OAuth2Handler } from "../../auth/oauth2";

export const OneDriveService: CloudService = {
  id: "onedrive",
  callbackId: COMMAND_CALLBACK_ONEDRIVE,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    const isFull = plugin.settings.serviceType === "onedrivefull";
    return new OneDriveProvider(
      isFull ? "full" : "app",
      isFull ? plugin.settings.onedrivefull : plugin.settings.onedrive,
      app.vault.getName(),
      () => plugin.saveSettings()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new OneDriveSettings(plugin, app, t);
  },

  async handleCallback(plugin: RemotelySavePlugin, params: Record<string, string>) {
    const isFull = plugin.settings.serviceType === "onedrivefull";
    const config = isFull ? plugin.settings.onedrivefull : plugin.settings.onedrive;

    const oauth = new OAuth2Handler({
      clientId: config.clientID || ONEDRIVE_CLIENT_ID,
      authEndpoint: `${config.authority}/oauth2/v2.0/authorize`,
      tokenEndpoint: `${config.authority}/oauth2/v2.0/token`,
      redirectUri: `obsidian://${isFull ? COMMAND_CALLBACK_ONEDRIVEFULL : COMMAND_CALLBACK_ONEDRIVE}`,
      scopes: isFull ? ["User.Read", "Files.ReadWrite", "offline_access"] : ["User.Read", "Files.ReadWrite.AppFolder", "offline_access"]
    });

    const tokens = await oauth.exchangeCode(params.code, plugin.oauth2Info.verifier);
    config.accessToken = tokens.access_token;
    config.refreshToken = tokens.refresh_token!;
    config.accessTokenExpiresAtTime = Date.now() + (tokens.expires_in * 1000) - 300000;

    await plugin.saveSettings();
    new Notice("OneDrive connected!");
  }
};
