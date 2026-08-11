import * as path from "path";
import type { Entity } from "../baseTypes";
import { FakeFs } from "./fsAll";
import type { RawFs } from "./rawFsInterface";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * A base class for cloud filesystems that handles path prefixing and normalization.
 */
export class BaseCloudFs extends FakeFs {
  constructor(
    public readonly kind: string,
    protected readonly rawFs: RawFs,
    protected readonly remotePrefix: string
  ) {
    super();
  }

  /**
   * Normalizes the prefix to ensure it ends with a slash if it's not empty.
   */
  protected get normalizedPrefix(): string {
    if (!this.remotePrefix) return "";
    let p = path.posix.normalize(this.remotePrefix.trim());
    if (p === "." || p === "/") return "";
    if (p.startsWith("/")) p = p.slice(1);
    if (!p.endsWith("/")) p = `${p}/`;
    return p;
  }

  protected toFullPath(key: string): string {
    const prefix = this.normalizedPrefix;
    if (!prefix) return key;
    if (key === "/" || key === "") return prefix;
    if (key.startsWith("/")) return `${prefix}${key.slice(1)}`;
    return `${prefix}${key}`;
  }

  protected toLocalKey(fullPath: string): string {
    const prefix = this.normalizedPrefix;
    if (!prefix) return fullPath;
    if (!fullPath.startsWith(prefix)) {
      throw new Error(`Path "${fullPath}" does not start with prefix "${prefix}"`);
    }
    return fullPath.slice(prefix.length);
  }

  async walk(): Promise<Entity[]> {
    const fullPath = this.toFullPath("");
    const entities = await this.rawFs.walk(fullPath, false);
    return entities.map(e => ({
      ...e,
      key: this.toLocalKey(e.key || ""),
      keyRaw: this.toLocalKey(e.keyRaw || e.key || ""),
    }));
  }

  async walkPartial(): Promise<Entity[]> {
    const fullPath = this.toFullPath("");
    const entities = await this.rawFs.walk(fullPath, true);
    return entities.map(e => ({
      ...e,
      key: this.toLocalKey(e.key || ""),
      keyRaw: this.toLocalKey(e.keyRaw || e.key || ""),
    }));
  }

  async stat(key: string): Promise<Entity> {
    const fullPath = this.toFullPath(key);
    const entity = await this.rawFs.stat(fullPath);
    return {
      ...entity,
      key: key,
      keyRaw: key,
    };
  }

  async mkdir(key: string, mtime?: number, ctime?: number): Promise<Entity> {
    const fullPath = this.toFullPath(key);
    const entity = await this.rawFs.mkdir(fullPath, mtime, ctime);
    return {
      ...entity,
      key: key,
      keyRaw: key,
    };
  }

  async writeFile(
    key: string,
    content: ArrayBuffer,
    mtime: number,
    ctime: number
  ): Promise<Entity> {
    const fullPath = this.toFullPath(key);
    const entity = await this.rawFs.writeFile(fullPath, content, mtime, ctime);
    return {
      ...entity,
      key: key,
      keyRaw: key,
    };
  }

  async readFile(key: string, versionId?: string): Promise<ArrayBuffer> {
    const fullPath = this.toFullPath(key);
    return await this.rawFs.readFile(fullPath, versionId);
  }

  async rm(key: string, versionId?: string): Promise<void> {
    if (key === "/" && !versionId) return;
    const fullPath = this.toFullPath(key);
    await this.rawFs.rm(fullPath, versionId);
  }

  async listVersions(key: string): Promise<Entity[]> {
    if (!this.rawFs.listVersions) {
      throw new Error("Versioning not supported by this provider");
    }
    const fullPath = this.toFullPath(key);
    const entities = await this.rawFs.listVersions(fullPath);
    return entities.map(e => ({
      ...e,
      key: key,
      keyRaw: key,
    }));
  }

  async rename(key1: string, key2: string): Promise<void> {
    if (!this.rawFs.rename) {
      return super.rename(key1, key2);
    }
    const fullPath1 = this.toFullPath(key1);
    const fullPath2 = this.toFullPath(key2);
    await this.rawFs.rename(fullPath1, fullPath2);
  }
}
