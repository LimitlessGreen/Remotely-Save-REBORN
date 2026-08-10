import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { FakeFsWebdis } from "../../fsWebdis";
import { WebdisSettings } from "./settings";
import type { CloudService } from "../serviceInterface";

export const WebdisService: CloudService = {
  id: "webdis",

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new FakeFsWebdis(plugin.settings.webdis, app.vault.getName(), () => plugin.saveSettings());
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new WebdisSettings(plugin, app, t);
  },
};
