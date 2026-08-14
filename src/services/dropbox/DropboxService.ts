import type { App } from "obsidian";
import { COMMAND_CALLBACK_DROPBOX } from "../../core/baseTypes";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { DropboxFileSystem } from "./DropboxFileSystem";
import { DropboxSettings } from "./DropboxSettings";

export const DropboxService: CloudService = {
  id: "dropbox",
  callbackId: COMMAND_CALLBACK_DROPBOX,
  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new DropboxFileSystem(
      plugin.settings.dropbox,
      app.vault.getName(),
      () => plugin.saveSettings()
    );
  },
  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new DropboxSettings(plugin, app, t);
  },
};
