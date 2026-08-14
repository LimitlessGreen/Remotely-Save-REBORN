import type { App } from "obsidian";
import type { TFunc } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import type { CloudService } from "../serviceInterface";
import { S3FileSystem } from "./S3FileSystem";
import { S3Settings } from "./S3Settings";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * S3 modular service implementation.
 */
export const S3Service: CloudService = {
  id: "s3",

  getProvider(plugin: RemotelySavePlugin, _app: App) {
    return new S3FileSystem(plugin.settings.s3);
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: TFunc) {
    return new S3Settings(plugin, app, t);
  },
};
