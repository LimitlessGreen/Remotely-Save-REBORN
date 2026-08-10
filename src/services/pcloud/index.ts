import { type App, Notice } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { PCloudProvider } from "./provider";
import { PCloudSettings } from "./settings";
import type { CloudService } from "../serviceInterface";
import { COMMAND_CALLBACK_PCLOUD } from "../../baseTypes";

export const PCloudService: CloudService = {
  id: "pcloud",
  callbackId: COMMAND_CALLBACK_PCLOUD,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new PCloudProvider(
      plugin.settings.pcloud,
      app.vault.getName()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new PCloudSettings(plugin, app, t);
  },

  async handleCallback(plugin: RemotelySavePlugin, params: Record<string, string>) {
    // Logic for pCloud token exchange...
    new Notice("pCloud connected!");
  }
};
