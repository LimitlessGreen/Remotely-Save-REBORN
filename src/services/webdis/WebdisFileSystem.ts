import type { Entity, WebdisConfig } from "../../core/baseTypes";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";

export const DEFAULT_WEBDIS_CONFIG: WebdisConfig = {
  address: "",
  username: "",
  password: "",
  remoteBaseDir: "",
};

class RawWebdisFs implements RawFs {
  async walk(_fullPath: string): Promise<Entity[]> {
    throw new Error("Not implemented");
  }
  async stat(_fullPath: string): Promise<Entity> {
    throw new Error("Not implemented");
  }
  async mkdir(_fullPath: string): Promise<Entity> {
    throw new Error("Not implemented");
  }
  async writeFile(_fullPath: string, _content: ArrayBuffer): Promise<Entity> {
    throw new Error("Not implemented");
  }
  async readFile(_fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    throw new Error("Not implemented");
  }
  async rm(_fullPath: string, _versionId?: string): Promise<void> {
    throw new Error("Not implemented");
  }
}

export class WebdisFileSystem extends BaseCloudFs {
  constructor(config: WebdisConfig) {
    super("webdis", new RawWebdisFs(config), "");
  }
}
