import type { App } from "obsidian";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { AzureFileSystem } from "./AzureFileSystem";
import { AzureSettings } from "./AzureSettings";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Azure Blob Storage modular service implementation.
 */
export const AzureService: CloudService = {
  id: "azureblobstorage",

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new AzureFileSystem(
      plugin.settings.azureblobstorage,
      app.vault.getName()
    );
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new AzureSettings(plugin, app, t);
  },
};
