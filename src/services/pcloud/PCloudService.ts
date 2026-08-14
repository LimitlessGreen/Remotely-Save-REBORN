import { type App, Notice } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { PCloudFileSystem } from "./PCloudFileSystem";
import { PCloudSettings } from "./PCloudSettings";
import type { CloudService } from "../serviceInterface";
import { COMMAND_CALLBACK_PCLOUD, PCLOUD_CLIENT_ID, PCLOUD_CLIENT_SECRET } from "../../core/baseTypes";
import { requestUrl } from "obsidian";

export const PCloudService: CloudService = {
  id: "pcloud",
  callbackId: COMMAND_CALLBACK_PCLOUD,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new PCloudFileSystem(
      plugin.settings.pcloud,
      app.vault.getName()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new PCloudSettings(plugin, app, t);
  },

  async handleCallback(plugin: RemotelySavePlugin, params: Record<string, string>) {
    const code = params.code;
    if (!code) {
      new Notice("pCloud connection failed: No code received.");
      return;
    }

    try {
      // The token endpoint depends on the region chosen by the user in settings
      const hostname = plugin.settings.pcloud.hostname || "api.pcloud.com";
      const tokenUrl = `https://${hostname}/oauth2_token?client_id=${PCLOUD_CLIENT_ID}&client_secret=${PCLOUD_CLIENT_SECRET}&code=${code}`;

      const response = await requestUrl({
        url: tokenUrl,
        method: "GET",
      });

      if (response.status !== 200) {
        throw new Error(`pCloud API error: ${response.status}`);
      }

      const data = response.json;
      if (data.access_token) {
        plugin.settings.pcloud.accessToken = data.access_token;
        if (data.locationid) {
          plugin.settings.pcloud.locationid = data.locationid as 1 | 2;
          plugin.settings.pcloud.hostname = data.locationid === 2 ? "eapi.pcloud.com" : "api.pcloud.com";
        }
        await plugin.saveSettings();
        new Notice("pCloud connected!");
      } else {
        throw new Error(data.error || "Unknown error during token exchange");
      }
    } catch (err) {
      console.error(err);
      new Notice(`pCloud connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
};
