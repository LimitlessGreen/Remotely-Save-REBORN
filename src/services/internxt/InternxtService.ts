import type { App } from "obsidian";
import { COMMAND_CALLBACK_INTERNXT } from "../../core/baseTypes";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { InternxtFileSystem } from "./InternxtFileSystem";
import { InternxtSettings } from "./InternxtSettings";

export const InternxtService: CloudService = {
  id: "internxt",
  callbackId: COMMAND_CALLBACK_INTERNXT,

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new InternxtFileSystem(
      plugin.settings.internxt,
      app.vault.getName(),
      () => plugin.saveSettings(),
      { clientName: plugin.manifest.id, clientVersion: plugin.manifest.version }
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new InternxtSettings(plugin, app, t);
  },
};
