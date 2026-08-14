import type { App } from "obsidian";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { WebdavFileSystem } from "./WebdavFileSystem";
import { WebdavSettings } from "./WebdavSettings";

export const WebdavService: CloudService = {
  id: "webdav",
  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new WebdavFileSystem(
      plugin.settings.webdav,
      app.vault.getName(),
      () => plugin.saveSettings()
    );
  },
  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new WebdavSettings(plugin, app, t);
  },
};
