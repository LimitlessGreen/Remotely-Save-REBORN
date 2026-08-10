import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { FakeFsWebdav } from "../../fsWebdav";
import { FakeFsNutStore } from "../../fsNutStore";
import { WebdavSettings } from "./settings";
import type { CloudService } from "../serviceInterface";

export const WebdavService: CloudService = {
  id: "webdav",

  getProvider(plugin: RemotelySavePlugin, app: App) {
    if (plugin.settings.webdav.address.includes("jianguoyun.com")) {
      return new FakeFsNutStore(plugin.settings.webdav, app.vault.getName(), () => plugin.saveSettings());
    }
    return new FakeFsWebdav(plugin.settings.webdav, app.vault.getName(), () => plugin.saveSettings());
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new WebdavSettings(plugin, app, t);
  },
};
