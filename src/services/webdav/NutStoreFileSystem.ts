import type { Entity, WebdavConfig } from "../../core/baseTypes";
import { WebdavFileSystem } from "./WebdavFileSystem";
import localforage from "localforage";
import { XMLParser } from "fast-xml-parser";
import { Base64 } from "js-base64";
import { requestUrl } from "obsidian";
import type { FileStat } from "webdav";
import Bottleneck from "bottleneck";
import { DEFAULT_DB_NAME, DEFAULT_TBL_NUTSTORE_DELTA_CACHE } from "../../core/storage/localdb";
import { isNil } from "lodash";
import { dirname } from "path";

interface DeltaCache {
  files: Entity[];
  originCursor: string;
  deltas: DeltaResponse[];
}

const deltaCache = localforage.createInstance({
  name: DEFAULT_DB_NAME,
  storeName: DEFAULT_TBL_NUTSTORE_DELTA_CACHE,
});

interface DeltaEntry {
  path: string;
  size: number;
  isDeleted: boolean;
  isDir: boolean;
  modified: string;
  revision: number;
}

interface DeltaResponse {
  reset: boolean;
  cursor: string;
  hasMore: boolean;
  delta: {
    entry: DeltaEntry[];
  };
}

const limiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 1000,
});

/**
 * NutStore is a specialized WebDAV service with delta sync support.
 */
export class NutStoreFileSystem extends WebdavFileSystem {
  constructor(config: WebdavConfig, vaultName: string, saveUpdatedConfigFunc: () => Promise<any>) {
    super(config, vaultName, saveUpdatedConfigFunc, "nutstore");
  }

  private async getDelta(folderName: string, cursor?: string): Promise<{ response: DeltaResponse }> {
    return limiter.schedule(async () => {
      const body = `<?xml version="1.0" encoding="utf-8"?>
              <s:delta xmlns:s="http://ns.jianguoyun.com">
                  <s:folderName>${folderName}</s:folderName>
                  <s:cursor>${cursor ?? ""}</s:cursor>
              </s:delta>`;
      const token = Base64.encode(`${(this as any).config.username}:${(this as any).config.password}`);
      const xml = await requestUrl({
        url: `https://dav.jianguoyun.com/nsdav/delta`,
        method: "POST",
        headers: {
          Authorization: `Basic ${token}`,
          "Content-Type": "application/xml",
        },
        body,
      });
      const parser = new XMLParser({ attributeNamePrefix: "", removeNSPrefix: true });
      const result = parser.parse(xml.text) as { response: DeltaResponse };
      if (!isNil(result?.response?.cursor)) {
        result.response.cursor = result.response.cursor.toString();
      }
      if (result.response.delta) {
        if (!Array.isArray(result.response.delta.entry)) {
          result.response.delta.entry = [result.response.delta.entry as any];
        }
      } else {
        result.response.delta = { entry: [] };
      }
      return result;
    });
  }

  private async getLatestDeltaCursor(folderName: string): Promise<{ response: { cursor: string } }> {
    return limiter.schedule(async () => {
      const body = `<?xml version="1.0" encoding="utf-8"?>
              <s:delta xmlns:s="http://ns.jianguoyun.com">
                  <s:folderName>${folderName}</s:folderName>
              </s:delta>`;
      const token = Base64.encode(`${(this as any).config.username}:${(this as any).config.password}`);
      const response = await requestUrl({
        url: `https://dav.jianguoyun.com/nsdav/latestDeltaCursor`,
        method: "POST",
        headers: { Authorization: `Basic ${token}`, "Content-Type": "application/xml" },
        body,
      });
      const parser = new XMLParser({ attributeNamePrefix: "", removeNSPrefix: true });
      return parser.parse(response.text) as any;
    });
  }

  async walk(): Promise<Entity[]> {
    const remoteBaseDir = (this as any).remotePrefix; // BaseCloudFs normalizedPrefix
    let cache = await deltaCache.getItem<DeltaCache>(remoteBaseDir);

    if (cache) {
      let cursor = cache.deltas.at(-1)?.cursor ?? cache.originCursor;
      while (true) {
        const events = await this.getDelta(remoteBaseDir, cursor);
        if (events.response.cursor === cursor) break;
        if (events.response.reset) {
          cache.deltas = [];
          cache.files = await super.walk();
          cursor = (await this.getLatestDeltaCursor(remoteBaseDir)).response.cursor;
        } else if (events.response.delta.entry.length > 0) {
          cache.deltas.push(events.response);
          if (events.response.hasMore) cursor = events.response.cursor;
          else break;
        } else break;
      }
    } else {
      const files = await super.walk();
      const { response: { cursor: originCursor } } = await this.getLatestDeltaCursor(remoteBaseDir);
      cache = { files, originCursor, deltas: [] };
    }

    await deltaCache.setItem(remoteBaseDir, cache);

    const filesMap = new Map(cache.files.map(f => [f.key, f]));
    for (const delta of cache.deltas.flatMap(d => d.delta.entry)) {
      const key = this.toLocalKey(delta.path);
      if (delta.isDeleted) {
        filesMap.delete(key);
      } else {
        filesMap.set(key, {
          key, keyRaw: key,
          mtimeSvr: Date.parse(delta.modified).valueOf(),
          mtimeCli: Date.parse(delta.modified).valueOf(),
          size: delta.size, sizeRaw: delta.size,
          synthesizedFolder: delta.isDir
        });
      }
    }
    return [...filesMap.values()].filter(x => x.key !== "" && x.key !== "/");
  }
}
