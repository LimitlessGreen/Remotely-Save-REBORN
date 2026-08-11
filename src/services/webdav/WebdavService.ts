import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { WebdavFileSystem } from "./WebdavFileSystem";
import type { CloudService } from "../serviceInterface";
import { WebdavSettings } from "./WebdavSettings";

export const WebdavService: CloudService = {
  id: "webdav",
  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new WebdavFileSystem(plugin.settings.webdav, app.vault.getName(), () => plugin.saveSettings());
  },
  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new WebdavSettings(plugin, app, t);
  },
};
