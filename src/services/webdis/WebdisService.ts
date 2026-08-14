import type { App } from "obsidian";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { WebdisFileSystem } from "./WebdisFileSystem";
import { WebdisSettings } from "./WebdisSettings";

export const WebdisService: CloudService = {
  id: "webdis",
  getProvider(plugin: RemotelySavePlugin, _app: App) {
    return new WebdisFileSystem(plugin.settings.webdis);
  },
  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new WebdisSettings(plugin, app, t);
  },
};
