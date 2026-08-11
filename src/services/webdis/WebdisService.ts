import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { WebdisFileSystem } from "./WebdisFileSystem";
import type { CloudService } from "../serviceInterface";
import { WebdisSettings } from "./WebdisSettings";

export const WebdisService: CloudService = {
  id: "webdis",
  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new WebdisFileSystem(plugin.settings.webdis);
  },
  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new WebdisSettings(plugin, app, t);
  },
};
