import { Buffer } from "buffer";
import { Queue } from "@fyears/tsqueue";
import chunk from "lodash/chunk";
import flatten from "lodash/flatten";
import { Platform, requestUrl, type RequestUrlParam } from "obsidian";
import type { FileStat, WebDAVClient } from "webdav";
import type { Entity, WebdavConfig } from "../../core/baseTypes";
import { VALID_REQURL } from "../../core/baseTypesObs";
import { bufferToArrayBuffer, splitFileSizeToChunkRanges } from "../../utils/misc";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";

export const DEFAULT_WEBDAV_CONFIG: WebdavConfig = {
  address: "",
  username: "",
  password: "",
  authType: "basic",
  depth: "manual_1",
  remoteBaseDir: "",
  manualRecursive: false,
};

// @ts-ignore
import { AuthType, createClient, getPatcher } from "webdav/dist/web/index.js";

// Global patch for Obsidian environment
if (VALID_REQURL) {
  getPatcher().patch("request", async (options: any): Promise<Response> => {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(options.headers)) {
      if (k.toLowerCase() === "host" || k.toLowerCase() === "content-length") continue;
      headers[k.toLowerCase()] = v as string;
    }
    const p: RequestUrlParam = {
      url: options.url, method: options.method,
      body: options.data as any, headers,
      contentType: headers["accept"] ?? headers["content-type"],
      throw: false,
    };
    let r = await requestUrl(p);
    if (r.status === 401 && Platform.isIosApp && !options.url.endsWith("/") && options.method.toUpperCase() === "PROPFIND") {
      p.url = `${options.url}/`;
      r = await requestUrl(p);
    }
    const statusText = "OK"; // Simplified
    return new Response([101, 103, 204, 205, 304].includes(r.status) ? null : r.arrayBuffer, {
      status: r.status, statusText, headers: r.headers as any
    });
  });
}

class RawWebdavFs implements RawFs {
  private client!: WebDAVClient;
  private isNextcloud = false;
  private supportApachePartial = false;
  private supportSabrePartial = false;
  private nextcloudUploadServerAddress = "";

  constructor(
    private config: WebdavConfig,
    private saveUpdatedConfigFunc: () => Promise<any>
  ) {}

  private async ensureInited() {
    if (this.client) return;
    const auth = this.config.username ? {
      username: this.config.username,
      password: this.config.password,
      authType: this.config.authType === "digest" ? AuthType.Digest : AuthType.Password
    } : {};
    this.client = createClient(this.config.address, {
      ...auth,
      headers: { "Cache-Control": "no-cache" }
    });

    const compliance = await this.client.getDAVCompliance("/");
    this.isNextcloud = compliance.compliance.some(c => c.toLowerCase().includes("nextcloud"));
    this.supportApachePartial = compliance.server.includes("Apache") && compliance.compliance.includes("<http://apache.org/dav/propset/fs/1>");
    this.supportSabrePartial = compliance.compliance.includes("sabredav-partialupdate");
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    await this.ensureInited();
    const contents: FileStat[] = [];
    if (partial || this.config.depth === "manual_1") {
      const q = new Queue([fullPath]);
      while (q.length > 0) {
        const path = q.pop()!;
        const list = await this.client.getDirectoryContents(path, { deep: false }) as FileStat[];
        for (const item of list) {
          if (item.filename === path) continue;
          contents.push(item);
          if (!partial && item.type === "directory") q.push(item.filename);
        }
        if (partial) break;
      }
    } else {
      contents.push(...await this.client.getDirectoryContents(fullPath, { deep: true }) as FileStat[]);
    }

    return contents.map(x => ({
      key: x.filename, keyRaw: x.filename,
      mtimeSvr: Date.parse(x.lastmod).valueOf(),
      mtimeCli: Date.parse(x.lastmod).valueOf(),
      size: x.size, sizeRaw: x.size,
      synthesizedFolder: x.type === "directory"
    }));
  }

  async stat(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    const x = await this.client.stat(fullPath) as FileStat;
    return {
      key: x.filename, keyRaw: x.filename,
      mtimeSvr: Date.parse(x.lastmod).valueOf(),
      mtimeCli: Date.parse(x.lastmod).valueOf(),
      size: x.size, sizeRaw: x.size,
    };
  }

  async mkdir(fullPath: string): Promise<Entity> {
    await this.ensureInited();
    await this.client.createDirectory(fullPath, { recursive: false });
    return await this.stat(fullPath);
  }

  async writeFile(fullPath: string, content: ArrayBuffer, mtime: number): Promise<Entity> {
    await this.ensureInited();
    // Simplified: always full upload for now, or add logic for chunks if needed
    await this.client.putFileContents(fullPath, content, { overwrite: true });
    return await this.stat(fullPath);
  }

  async readFile(fullPath: string, _versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    const data = await this.client.getFileContents(fullPath);
    return data instanceof ArrayBuffer ? data : bufferToArrayBuffer(data as Buffer);
  }

  async rm(fullPath: string, _versionId?: string): Promise<void> {
    await this.ensureInited();
    await this.client.deleteFile(fullPath);
  }

  async rename(fullPath1: string, fullPath2: string): Promise<void> {
    await this.ensureInited();
    await this.client.moveFile(fullPath1, fullPath2);
  }
}

export class WebdavFileSystem extends BaseCloudFs {
  constructor(config: WebdavConfig, vaultName: string, saveUpdatedConfigFunc: () => Promise<any>, kind = "webdav") {
    super(kind, new RawWebdavFs(config, saveUpdatedConfigFunc), config.remoteBaseDir || vaultName);
  }
}
