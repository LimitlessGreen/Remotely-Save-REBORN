import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { InternxtFileSystem } from "./InternxtFileSystem";
import { InternxtSettings } from "./InternxtSettings";
import type { CloudService } from "../serviceInterface";
import { COMMAND_CALLBACK_INTERNXT } from "../../core/baseTypes";

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

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new InternxtSettings(plugin, app, t);
  },
};
