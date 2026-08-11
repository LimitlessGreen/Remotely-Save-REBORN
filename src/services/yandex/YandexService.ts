import { type App, Notice } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { YandexFileSystem } from "./YandexFileSystem";
import { YandexDiskSettings } from "./YandexSettings";
import type { CloudService } from "../serviceInterface";
import { COMMAND_CALLBACK_YANDEXDISK, YANDEXDISK_CLIENT_ID, YANDEXDISK_CLIENT_SECRET } from "../../core/baseTypes";
import { OAuth2Handler } from "../../auth/oauth2";

export const YandexDiskService: CloudService = {
  id: "yandexdisk",
  callbackId: COMMAND_CALLBACK_YANDEXDISK,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new YandexFileSystem(
      plugin.settings.yandexdisk,
      app.vault.getName(),
      () => plugin.saveSettings()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new YandexDiskSettings(plugin, app, t);
  },

  async handleCallback(plugin: RemotelySavePlugin, params: Record<string, string>) {
    const oauth = new OAuth2Handler({
      clientId: YANDEXDISK_CLIENT_ID,
      clientSecret: YANDEXDISK_CLIENT_SECRET,
      authEndpoint: "https://oauth.yandex.com/authorize",
      tokenEndpoint: "https://oauth.yandex.com/token",
      redirectUri: `obsidian://${COMMAND_CALLBACK_YANDEXDISK}`,
      scopes: []
    });

    const tokens = await oauth.exchangeCode(params.code);
    plugin.settings.yandexdisk.accessToken = tokens.access_token;
    plugin.settings.yandexdisk.refreshToken = tokens.refresh_token!;
    plugin.settings.yandexdisk.accessTokenExpiresAtTimeMs = Date.now() + (tokens.expires_in * 1000) - 300000;

    await plugin.saveSettings();
    new Notice("Yandex Disk connected!");
  }
};
