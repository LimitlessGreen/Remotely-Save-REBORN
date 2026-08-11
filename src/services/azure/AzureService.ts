import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { AzureFileSystem } from "./AzureFileSystem";
import type { CloudService } from "../serviceInterface";
import { AzureSettings } from "./AzureSettings";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Azure Blob Storage modular service implementation.
 */
export const AzureService: CloudService = {
  id: "azureblobstorage",

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new AzureFileSystem(plugin.settings.azureblobstorage, app.vault.getName());
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new AzureSettings(plugin, app, t);
  },
};
