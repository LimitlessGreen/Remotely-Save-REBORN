import { type App, Notice } from "obsidian";
import { OAuth2Handler } from "../../auth/oauth2";
import {
  BOX_CLIENT_ID,
  BOX_CLIENT_SECRET,
  COMMAND_CALLBACK_BOX,
} from "../../core/baseTypes";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { BoxFileSystem } from "./BoxFileSystem";
import { BoxSettings } from "./BoxSettings";

export const BoxService: CloudService = {
  id: "box",
  callbackId: COMMAND_CALLBACK_BOX,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new BoxFileSystem(plugin.settings.box, app.vault.getName(), () =>
      plugin.saveSettings()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new BoxSettings(plugin, app, t);
  },

  async handleCallback(
    plugin: RemotelySavePlugin,
    params: Record<string, string>
  ) {
    const oauth = new OAuth2Handler({
      clientId: BOX_CLIENT_ID,
      clientSecret: BOX_CLIENT_SECRET,
      authEndpoint: "https://account.box.com/api/oauth2/authorize",
      tokenEndpoint: "https://api.box.com/oauth2/token",
      redirectUri: `obsidian://${COMMAND_CALLBACK_BOX}`,
      scopes: [],
    });

    const tokens = await oauth.exchangeCode(params.code);
    plugin.settings.box.accessToken = tokens.access_token;
    plugin.settings.box.refreshToken = tokens.refresh_token ?? "";
    plugin.settings.box.accessTokenExpiresAtTimeMs =
      Date.now() + tokens.expires_in * 1000 - 300000;

    await plugin.saveSettings();
    new Notice("Box connected!");
  },
};
