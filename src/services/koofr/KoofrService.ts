import { type App, Notice } from "obsidian";
import { OAuth2Handler } from "../../auth/oauth2";
import {
  COMMAND_CALLBACK_KOOFR,
  KOOFR_CLIENT_ID,
  KOOFR_CLIENT_SECRET,
} from "../../core/baseTypes";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { KoofrFileSystem } from "./KoofrFileSystem";
import { KoofrSettings } from "./KoofrSettings";

export const KoofrService: CloudService = {
  id: "koofr",
  callbackId: COMMAND_CALLBACK_KOOFR,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new KoofrFileSystem(plugin.settings.koofr, app.vault.getName(), () =>
      plugin.saveSettings()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new KoofrSettings(plugin, app, t);
  },

  async handleCallback(
    plugin: RemotelySavePlugin,
    params: Record<string, string>
  ) {
    const oauth = new OAuth2Handler({
      clientId: KOOFR_CLIENT_ID,
      clientSecret: KOOFR_CLIENT_SECRET,
      authEndpoint: `${plugin.settings.koofr.api}/oauth2/auth`,
      tokenEndpoint: `${plugin.settings.koofr.api}/oauth2/token`,
      redirectUri: `obsidian://${COMMAND_CALLBACK_KOOFR}`,
      scopes: ["public"],
    });

    const tokens = await oauth.exchangeCode(params.code);
    plugin.settings.koofr.accessToken = tokens.access_token;
    plugin.settings.koofr.refreshToken = tokens.refresh_token ?? "";
    plugin.settings.koofr.accessTokenExpiresAtTimeMs =
      Date.now() + tokens.expires_in * 1000 - 300000;

    await plugin.saveSettings();
    new Notice("Koofr connected!");
  },
};
