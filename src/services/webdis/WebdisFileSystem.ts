import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import type { Entity, WebdisConfig } from "../../core/baseTypes";

export const DEFAULT_WEBDIS_CONFIG: WebdisConfig = {
  address: "",
  username: "",
  password: "",
  remoteBaseDir: "",
};

class RawWebdisFs implements RawFs {
  constructor(private config: WebdisConfig) {}

  async walk(fullPath: string): Promise<Entity[]> { throw new Error("Not implemented"); }
  async stat(fullPath: string): Promise<Entity> { throw new Error("Not implemented"); }
  async mkdir(fullPath: string): Promise<Entity> { throw new Error("Not implemented"); }
  async writeFile(fullPath: string, content: ArrayBuffer): Promise<Entity> { throw new Error("Not implemented"); }
  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> { throw new Error("Not implemented"); }
  async rm(fullPath: string, _versionId?: string): Promise<void> { throw new Error("Not implemented"); }
}

export class WebdisFileSystem extends BaseCloudFs {
  constructor(config: WebdisConfig) {
    super("webdis", new RawWebdisFs(config), "");
  }
}
