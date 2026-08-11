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

import { XMLParser } from "fast-xml-parser";
import { Base64 } from "js-base64";

export class RawWebdavFs implements RawFs {
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

    try {
      const compliance = await this.client.getDAVCompliance("/");
      this.isNextcloud = compliance.compliance.some(c => c.toLowerCase().includes("nextcloud"));
      this.supportApachePartial = compliance.server.includes("Apache") && compliance.compliance.includes("<http://apache.org/dav/propset/fs/1>");
      this.supportSabrePartial = compliance.compliance.includes("sabredav-partialupdate");
    } catch (e) {
      // Best effort
    }
  }

  private async getNextcloudFileId(fullPath: string): Promise<string> {
    const auth = Base64.encode(`${this.config.username}:${this.config.password}`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
      <d:prop>
        <oc:fileid />
      </d:prop>
    </d:propfind>`;

    const res = await requestUrl({
      url: `${this.config.address.replace(/\/$/, "")}${fullPath.startsWith("/") ? "" : "/"}${fullPath}`,
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "text/xml",
        Depth: "0"
      },
      body: xml,
    });

    const parser = new XMLParser({ removeNSPrefix: true });
    const result = parser.parse(res.text);
    const fileId = result?.multistatus?.response?.propstat?.prop?.fileid;

    if (!fileId) {
      console.error(`Nextcloud PROPFIND debug result: ${JSON.stringify(result)}`);
      throw new Error("Could not find Nextcloud fileid");
    }
    return fileId.toString();
  }

  private getNextcloudVersionsUrl(fileId: string): string {
    // Address example: https://cloud.example.com/remote.php/dav/files/admin/
    // We need to change "files" to "versions" and remove the path after user
    const url = new URL(this.config.address);
    const parts = url.pathname.split("/").filter(Boolean);
    const davIdx = parts.indexOf("dav");
    if (davIdx === -1 || parts[davIdx+1] !== "files") throw new Error("Unsupported Nextcloud URL structure");

    const user = parts[davIdx+2];
    const newPath = `/${parts.slice(0, davIdx+1).join("/")}/versions/${user}/versions/${fileId}`;
    return `${url.origin}${newPath}`;
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

  async readFile(fullPath: string, versionId?: string): Promise<ArrayBuffer> {
    await this.ensureInited();
    if (versionId && this.isNextcloud) {
      // In Nextcloud, versionId is the timestamp
      const fileId = await this.getNextcloudFileId(fullPath);
      const url = `${this.getNextcloudVersionsUrl(fileId)}/${versionId}`;
      const auth = Base64.encode(`${this.config.username}:${this.config.password}`);
      const res = await requestUrl({
        url, method: "GET",
        headers: { Authorization: `Basic ${auth}` }
      });
      return res.arrayBuffer;
    }
    const data = await this.client.getFileContents(fullPath);
    return data instanceof ArrayBuffer ? data : bufferToArrayBuffer(data as Buffer);
  }

  async rm(fullPath: string, versionId?: string): Promise<void> {
    await this.ensureInited();
    if (versionId && this.isNextcloud) {
      const fileId = await this.getNextcloudFileId(fullPath);
      const url = `${this.getNextcloudVersionsUrl(fileId)}/${versionId}`;
      const auth = Base64.encode(`${this.config.username}:${this.config.password}`);
      await requestUrl({
        url, method: "DELETE",
        headers: { Authorization: `Basic ${auth}` }
      });
      return;
    }
    await this.client.deleteFile(fullPath);
  }

  async listVersions(fullPath: string): Promise<Entity[]> {
    await this.ensureInited();
    if (!this.isNextcloud) throw new Error("Versioning only supported for Nextcloud WebDAV currently");

    const fileId = await this.getNextcloudFileId(fullPath);
    const url = this.getNextcloudVersionsUrl(fileId);
    const auth = Base64.encode(`${this.config.username}:${this.config.password}`);

    const res = await requestUrl({
      url, method: "PROPFIND",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "text/xml",
        Depth: "1"
      }
    });

    const parser = new XMLParser({ removeNSPrefix: true });
    const result = parser.parse(res.text);
    const entries = Array.isArray(result?.multistatus?.response) ? result.multistatus.response : [result?.multistatus?.response].filter(Boolean);

    return entries.filter((e: any) => e.href.endsWith(fileId) === false).map((e: any) => {
      const href = e.href as string;
      const verId = href.split("/").pop()!;
      const mtime = e.propstat?.prop?.getlastmodified ? Date.parse(e.propstat.prop.getlastmodified).valueOf() : Date.now();
      return {
        key: fullPath,
        keyRaw: fullPath,
        size: parseInt(e.propstat?.prop?.getcontentlength || "0"),
        sizeRaw: parseInt(e.propstat?.prop?.getcontentlength || "0"),
        mtimeSvr: mtime,
        mtimeCli: mtime,
        versionId: verId,
        isLatest: false
      };
    });
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
