import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { FakeFsDropbox } from "../../fsDropbox";
import type { CloudService } from "../serviceInterface";
import { DropboxSettings } from "./settings";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Dropbox modular service implementation.
 */
export const DropboxService: CloudService = {
  id: "dropbox",

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new FakeFsDropbox(plugin.settings.dropbox, app.vault.getName(), () => plugin.saveSettings());
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new DropboxSettings(plugin, app, t);
  },
};
