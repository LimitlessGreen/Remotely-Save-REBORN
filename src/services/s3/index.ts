import { type App } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { FakeFsS3 } from "./provider";
import type { CloudService } from "../serviceInterface";
import { S3Settings } from "./settings";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * S3 modular service implementation.
 */
export const S3Service: CloudService = {
  id: "s3",

  getProvider(plugin: RemotelySavePlugin, app: App) {
    return new FakeFsS3(plugin.settings.s3);
  },

  getSettings(plugin: RemotelySavePlugin, app: App, t: any) {
    return new S3Settings(plugin, app, t);
  },
};
