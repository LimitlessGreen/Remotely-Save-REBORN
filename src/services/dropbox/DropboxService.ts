import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { DropboxFileSystem } from "./DropboxFileSystem";
import type { CloudService } from "../serviceInterface";
import { DropboxSettings } from "./DropboxSettings";
import { COMMAND_CALLBACK_DROPBOX } from "../../core/baseTypes";

export const DropboxService: CloudService = {
  id: "dropbox",
  callbackId: COMMAND_CALLBACK_DROPBOX,
  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new DropboxFileSystem(plugin.settings.dropbox, app.vault.getName(), () => plugin.saveSettings());
  },
  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new DropboxSettings(plugin, app, t);
  },
};
