import { type App, Notice } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { GoogleDriveProvider } from "./provider";
import { GoogleDriveSettings } from "./settings";
import type { CloudService } from "../serviceInterface";
import { COMMAND_CALLBACK_GOOGLEDRIVE } from "../../baseTypes";
import { OAuth2Handler } from "../../auth/oauth2";
import { GOOGLEDRIVE_CLIENT_ID, GOOGLEDRIVE_CLIENT_SECRET } from "../../baseTypes";

export const GoogleDriveService: CloudService = {
  id: "googledrive",
  callbackId: COMMAND_CALLBACK_GOOGLEDRIVE,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new GoogleDriveProvider(
      plugin.settings.googledrive,
      app.vault.getName(),
      () => plugin.saveSettings()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new GoogleDriveSettings(plugin, app, t);
  },

  async handleCallback(plugin: RemotelySavePlugin, params: Record<string, string>) {
    if (!params.code) throw new Error("No code in callback");

    const oauth = new OAuth2Handler({
      clientId: GOOGLEDRIVE_CLIENT_ID,
      clientSecret: GOOGLEDRIVE_CLIENT_SECRET,
      authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      redirectUri: `obsidian://${COMMAND_CALLBACK_GOOGLEDRIVE}`,
      scopes: ["https://www.googleapis.com/auth/drive.file"]
    });

    const tokens = await oauth.exchangeCode(params.code);
    plugin.settings.googledrive.refreshToken = params.code; // or tokens.refresh_token if available
    plugin.settings.googledrive.accessToken = tokens.access_token;
    plugin.settings.googledrive.accessTokenExpiresAtTimeMs = Date.now() + (tokens.expires_in * 1000) - 300000;

    await plugin.saveSettings();
    new Notice("Google Drive connected!");
  }
};
