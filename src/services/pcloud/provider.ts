/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * FakeFs Provider for pCloud
 */

import { FakeFs } from "../../fsAll";
import { type Entity, type PCloudConfig } from "../../baseTypes";
import { PCloudApiClient } from "./client";

export class PCloudProvider extends FakeFs {
  kind: "pcloud" = "pcloud";
  private api: PCloudApiClient | null = null;
  private rootId: number | null = null;
  private idMap = new Map<string, number>();

  constructor(
    private config: PCloudConfig,
    private vaultName: string
  ) {
    super();
  }

  async walk(): Promise<Entity[]> {
    await this.init();
    const list: Entity[] = [];

    const traverse = async (folderId: number, path: string) => {
      const res = await this.api!.listFolder(folderId);
      for (const item of res.contents || []) {
        const isDir = item.isfolder;
        const key = path + item.name + (isDir ? "/" : "");
        list.push({
          key, keyRaw: key,
          sizeRaw: item.size || 0,
          mtimeSvr: item.modified ? Date.parse(item.modified).valueOf() : Date.now(),
        });
        if (isDir) {
          this.idMap.set(key, item.folderid);
          await traverse(item.folderid, key);
        }
      }
    };

    await traverse(this.rootId!, "");
    return list;
  }

  async readFile(path: string): Promise<ArrayBuffer> {
    await this.init();
    return await this.api!.downloadFile(path);
  }

  async writeFile(path: string, content: ArrayBuffer): Promise<Entity> {
    await this.init();
    const name = path.split("/").filter(Boolean).pop()!;
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/") + 1) : "";
    const parentId = parentPath ? this.idMap.get(parentPath) : this.rootId;

    const res = await this.api!.uploadFile(name, parentId!, content);
    const meta = res.metadata[0];
    return {
      key: path, keyRaw: path,
      sizeRaw: meta.size || 0,
      mtimeSvr: Date.parse(meta.modified).valueOf(),
    };
  }

  async rm(path: string): Promise<void> {
    await this.init();
    await this.api!.deleteFile(path);
  }

  async mkdir(path: string): Promise<Entity> {
    await this.init();
    const name = path.replace(/\/$/, "").split("/").pop()!;
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/", path.length - 2) + 1) : "";
    const parentId = parentPath ? this.idMap.get(parentPath) : this.rootId;

    const res = await this.api!.createFolder(name, parentId!);
    this.idMap.set(path, res.metadata.folderid);
    return { key: path, keyRaw: path, sizeRaw: 0, mtimeSvr: Date.now() };
  }

  private async init() {
    if (this.api && this.rootId !== null) return;
    this.api = new PCloudApiClient(this.config.accessToken, this.config.locationid);

    const target = this.config.remoteBaseDir || this.vaultName;
    const root = await this.api.listFolder(0);
    const found = root.contents.find((i: any) => i.name === target && i.isfolder);

    if (found) {
      this.rootId = found.folderid;
    } else {
      const res = await this.api.createFolder(target, 0);
      this.rootId = res.metadata.folderid;
    }
  }
}
