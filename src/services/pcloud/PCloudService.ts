import { type App, Notice } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { PCloudFileSystem } from "./PCloudFileSystem";
import { PCloudSettings } from "./PCloudSettings";
import type { CloudService } from "../serviceInterface";
import { COMMAND_CALLBACK_PCLOUD } from "../../core/baseTypes";

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
    // Logic for pCloud token exchange...
    new Notice("pCloud connected!");
  }
};
