import type { _Object, PutObjectCommandInput } from "@aws-sdk/client-s3";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandInput,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { HttpHandlerOptions } from "@aws-sdk/types";
import {
  FetchHttpHandler,
  type FetchHttpHandlerOptions,
} from "@smithy/fetch-http-handler";
// @ts-expect-error
import { requestTimeout } from "@smithy/fetch-http-handler/dist-es/request-timeout";
import { type HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { buildQueryString } from "@smithy/querystring-builder";
import { Buffer } from "buffer";
import * as mime from "mime-types";
import { type RequestUrlParam, requestUrl } from "obsidian";
import PQueue from "p-queue";
import { Readable } from "stream";
import {
  DEFAULT_CONTENT_TYPE,
  type Entity,
  type S3Config,
} from "../../core/baseTypes";
import { VALID_REQURL } from "../../core/baseTypesObs";
import { BaseCloudFs } from "../../core/fs/baseCloudFs";
import type { RawFs } from "../../core/fs/rawFsInterface";
import { bufferToArrayBuffer, getFolderLevels } from "../../utils/misc";

export const DEFAULT_S3_CONFIG: S3Config = {
  s3Endpoint: "",
  s3Region: "",
  s3AccessKeyID: "",
  s3SecretAccessKey: "",
  s3BucketName: "",
  partsConcurrency: 20,
  forcePathStyle: false,
  remotePrefix: "",
  useAccurateMTime: false,
  generateFolderObject: false,
  bypassCorsLocally: false,
};

/**
 * Obsidian-specific HTTP handler for AWS SDK
 */
class ObsHttpHandler extends FetchHttpHandler {
  requestTimeoutInMs: number | undefined;
  reverseProxyNoSignUrl: string | undefined;
  constructor(
    options?: FetchHttpHandlerOptions,
    reverseProxyNoSignUrl?: string
  ) {
    super(options);
    this.requestTimeoutInMs =
      options === undefined ? undefined : options.requestTimeout;
    this.reverseProxyNoSignUrl = reverseProxyNoSignUrl;
  }
  async handle(
    request: HttpRequest,
    { abortSignal }: HttpHandlerOptions = {}
  ): Promise<{ response: HttpResponse }> {
    if (abortSignal?.aborted) {
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
      return Promise.reject(abortError);
    }

    let path = request.path;
    if (request.query) {
      const queryString = buildQueryString(request.query);
      if (queryString) {
        path += `?${queryString}`;
      }
    }

    const { port, method } = request;
    let url = `${request.protocol}//${request.hostname}${
      port ? `:${port}` : ""
    }${path}`;
    if (
      this.reverseProxyNoSignUrl !== undefined &&
      this.reverseProxyNoSignUrl !== ""
    ) {
      const urlObj = new URL(url);
      urlObj.host = this.reverseProxyNoSignUrl;
      url = urlObj.href;
    }
    const body =
      method === "GET" || method === "HEAD" ? undefined : request.body;

    const transformedHeaders: Record<string, string> = {};
    for (const key of Object.keys(request.headers)) {
      const keyLower = key.toLowerCase();
      if (keyLower === "host" || keyLower === "content-length") {
        continue;
      }
      transformedHeaders[keyLower] = request.headers[key];
    }

    let contentType: string | undefined;
    if (transformedHeaders["content-type"] !== undefined) {
      contentType = transformedHeaders["content-type"];
    }

    let transformedBody: any = body;
    if (ArrayBuffer.isView(body)) {
      transformedBody = bufferToArrayBuffer(body);
    }

    const param: RequestUrlParam = {
      body: transformedBody,
      headers: transformedHeaders,
      method: method,
      url: url,
      contentType: contentType,
    };

    const raceOfPromises = [
      requestUrl(param).then((rsp) => {
        const headers = rsp.headers;
        const headersLower: Record<string, string> = {};
        for (const key of Object.keys(headers)) {
          headersLower[key.toLowerCase()] = headers[key];
        }
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(rsp.arrayBuffer));
            controller.close();
          },
        });
        return {
          response: new HttpResponse({
            headers: headersLower,
            statusCode: rsp.status,
            body: stream,
          }),
        };
      }),
      requestTimeout(this.requestTimeoutInMs),
    ];

    if (abortSignal) {
      raceOfPromises.push(
        new Promise<never>((_resolve, reject) => {
          abortSignal.onabort = () => {
            const abortError = new Error("Request aborted");
            abortError.name = "AbortError";
            reject(abortError);
          };
        })
      );
    }
    return Promise.race(raceOfPromises);
  }
}

async function getObjectBodyToArrayBuffer(
  b: Readable | ReadableStream | Blob | undefined
) {
  if (b === undefined) {
    throw Error(`ObjectBody is undefined`);
  }
  if (b instanceof Readable) {
    return (await new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      b.on("data", (chunk) => chunks.push(chunk));
      b.on("error", reject);
      b.on("end", () => resolve(bufferToArrayBuffer(Buffer.concat(chunks))));
    })) as ArrayBuffer;
  } else if (b instanceof ReadableStream) {
    return await new Response(b, {}).arrayBuffer();
  } else if (b instanceof Blob) {
    return await b.arrayBuffer();
  } else {
    throw TypeError(`Unsupported body type`);
  }
}

/**
 * Raw S3 implementation acting on full remote paths.
 */
export class RawS3Fs implements RawFs {
  private s3Client: S3Client;
  private synthFoldersCache: Record<string, Entity> = {};

  constructor(private config: S3Config) {
    let endpoint = config.s3Endpoint;
    if (!(endpoint.startsWith("http://") || endpoint.startsWith("https://"))) {
      endpoint = `https://${endpoint}`;
    }

    if (VALID_REQURL && config.bypassCorsLocally) {
      this.s3Client = new S3Client({
        region: config.s3Region,
        endpoint: endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.s3AccessKeyID,
          secretAccessKey: config.s3SecretAccessKey,
        },
        requestHandler: new ObsHttpHandler(
          undefined,
          config.reverseProxyNoSignUrl
        ),
      });
    } else {
      this.s3Client = new S3Client({
        region: config.s3Region,
        endpoint: endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.s3AccessKeyID,
          secretAccessKey: config.s3SecretAccessKey,
        },
      });
    }

    this.s3Client.middlewareStack.add(
      (next) => (args) => {
        (args.request as any).headers["cache-control"] = "no-cache";
        return next(args);
      },
      { step: "build" }
    );
  }

  private fromS3ObjectToEntity(
    x: _Object,
    mtimeRecords: Record<string, number>
  ): Entity {
    if (x.LastModified === undefined) throw Error(`Missing LastModified`);
    const mtimeSvr = Math.floor(x.LastModified.valueOf() / 1000.0) * 1000;
    let mtimeCli = mtimeSvr;
    if (x.Key! in mtimeRecords) {
      const m2 = mtimeRecords[x.Key!];
      mtimeCli = m2 >= 1000000000000 ? m2 : m2 * 1000;
    }
    return {
      key: x.Key!,
      keyRaw: x.Key!,
      mtimeSvr,
      mtimeCli,
      sizeRaw: x.Size!,
      size: x.Size!,
      etag: x.ETag,
      synthesizedFolder: false,
    };
  }

  async walk(fullPath: string, partial: boolean): Promise<Entity[]> {
    const confCmd: ListObjectsV2CommandInput = {
      Bucket: this.config.s3BucketName,
      Prefix: fullPath || undefined,
      MaxKeys: partial ? 10 : undefined,
    };

    const contents: _Object[] = [];
    const mtimeRecords: Record<string, number> = {};
    const queueHead = new PQueue({
      concurrency: partial ? 1 : this.config.partsConcurrency,
    });

    let isTruncated = true;
    do {
      const rsp = await this.s3Client.send(new ListObjectsV2Command(confCmd));
      if (rsp.Contents) contents.push(...rsp.Contents);

      if (this.config.useAccurateMTime && rsp.Contents) {
        for (const content of rsp.Contents) {
          queueHead.add(async () => {
            try {
              const rspHead = await this.s3Client.send(
                new HeadObjectCommand({
                  Bucket: this.config.s3BucketName,
                  Key: content.Key,
                })
              );
              if (rspHead.Metadata) {
                mtimeRecords[content.Key!] = Math.floor(
                  Number.parseFloat(
                    rspHead.Metadata.mtime || rspHead.Metadata.MTime || "0"
                  )
                );
              }
            } catch (e) {
              console.warn(`Failed to HEAD ${content.Key}`, e);
            }
          });
        }
      }

      if (partial) {
        isTruncated = false;
      } else {
        isTruncated = rsp.IsTruncated ?? false;
        confCmd.ContinuationToken = rsp.NextContinuationToken;
      }
    } while (isTruncated);

    await queueHead.onIdle();

    const res: Entity[] = [];
    const realEntities = new Set<string>();
    for (const remoteObj of contents) {
      const entity = this.fromS3ObjectToEntity(remoteObj, mtimeRecords);
      realEntities.add(entity.key || "");
      res.push(entity);

      for (const f of getFolderLevels(entity.key || "", true)) {
        if (realEntities.has(f)) {
          delete this.synthFoldersCache[f];
          continue;
        }
        if (
          !this.synthFoldersCache[f] ||
          entity.mtimeSvr! >= this.synthFoldersCache[f].mtimeSvr!
        ) {
          this.synthFoldersCache[f] = {
            key: f,
            keyRaw: f,
            size: 0,
            sizeRaw: 0,
            mtimeSvr: entity.mtimeSvr,
            mtimeCli: entity.mtimeCli,
            synthesizedFolder: true,
          };
        }
      }
    }
    return [...res, ...Object.values(this.synthFoldersCache)];
  }

  async stat(fullPath: string): Promise<Entity> {
    if (this.synthFoldersCache[fullPath])
      return this.synthFoldersCache[fullPath];
    const res = await this.s3Client.send(
      new HeadObjectCommand({ Bucket: this.config.s3BucketName, Key: fullPath })
    );
    if (!res.LastModified) throw Error(`Missing LastModified`);
    const mtimeSvr = Math.floor(res.LastModified.valueOf() / 1000.0) * 1000;
    let mtimeCli = mtimeSvr;
    if (this.config.useAccurateMTime && res.Metadata) {
      const m2 = Math.floor(
        Number.parseFloat(res.Metadata.mtime || res.Metadata.MTime || "0")
      );
      mtimeCli = m2 >= 1000000000000 ? m2 : m2 * 1000;
    }
    return {
      key: fullPath,
      keyRaw: fullPath,
      mtimeSvr,
      mtimeCli,
      sizeRaw: res.ContentLength || 0,
      size: res.ContentLength || 0,
      etag: res.ETag,
      synthesizedFolder: false,
      versionId: res.VersionId,
    };
  }

  async mkdir(
    fullPath: string,
    mtime?: number,
    ctime?: number
  ): Promise<Entity> {
    if (!this.config.generateFolderObject) {
      const synth = {
        key: fullPath,
        keyRaw: fullPath,
        size: 0,
        sizeRaw: 0,
        mtimeSvr: mtime,
        mtimeCli: mtime,
        synthesizedFolder: true,
      };
      this.synthFoldersCache[fullPath] = synth;
      return synth;
    }

    const p: PutObjectCommandInput = {
      Bucket: this.config.s3BucketName,
      Key: fullPath,
      Body: "",
      ContentType: DEFAULT_CONTENT_TYPE,
      ContentLength: 0,
      Metadata: mtime
        ? { MTime: `${mtime / 1000.0}`, CTime: `${(ctime || mtime) / 1000.0}` }
        : undefined,
    };
    await this.s3Client.send(new PutObjectCommand(p));
    return await this.stat(fullPath);
  }

  async writeFile(
    fullPath: string,
    content: ArrayBuffer,
    mtime: number,
    ctime: number
  ): Promise<Entity> {
    const upload = new Upload({
      client: this.s3Client,
      queueSize: this.config.partsConcurrency,
      partSize: 5242880,
      params: {
        Bucket: this.config.s3BucketName,
        Key: fullPath,
        Body: new Uint8Array(content),
        ContentType:
          mime.contentType(mime.lookup(fullPath) || DEFAULT_CONTENT_TYPE) ||
          DEFAULT_CONTENT_TYPE,
        Metadata: { MTime: `${mtime / 1000.0}`, CTime: `${ctime / 1000.0}` },
      },
    });
    await upload.done();
    return await this.stat(fullPath);
  }

  async readFile(fullPath: string, versionId?: string): Promise<ArrayBuffer> {
    const data = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.config.s3BucketName,
        Key: fullPath,
        VersionId: versionId,
      })
    );
    return await getObjectBodyToArrayBuffer(data.Body);
  }

  async rm(fullPath: string, versionId?: string): Promise<void> {
    if (
      fullPath.endsWith("/") &&
      this.synthFoldersCache[fullPath] &&
      !versionId
    ) {
      delete this.synthFoldersCache[fullPath];
      return;
    }
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.config.s3BucketName,
          Key: fullPath,
          VersionId: versionId,
        })
      );
    } catch (_e) {
      // Best effort
    }
  }

  async listVersions(fullPath: string): Promise<Entity[]> {
    const res = await this.s3Client.send(
      new ListObjectVersionsCommand({
        Bucket: this.config.s3BucketName,
        Prefix: fullPath,
      })
    );

    const versions: Entity[] = [];
    if (res.Versions) {
      for (const v of res.Versions) {
        if (v.Key !== fullPath) continue;
        const mtimeSvr = v.LastModified
          ? Math.floor(v.LastModified.valueOf() / 1000.0) * 1000
          : 0;
        versions.push({
          key: v.Key,
          keyRaw: v.Key!,
          size: v.Size || 0,
          sizeRaw: v.Size || 0,
          mtimeSvr,
          mtimeCli: mtimeSvr, // We don't have accurate mtime in version listing without extra HEAD calls
          versionId: v.VersionId,
          isLatest: v.IsLatest,
          etag: v.ETag,
        });
      }
    }
    return versions;
  }

  async checkConnect(): Promise<boolean> {
    const rsp = await this.s3Client.send(
      new ListObjectsV2Command({ Bucket: this.config.s3BucketName, MaxKeys: 1 })
    );
    return rsp.$metadata.httpStatusCode === 200;
  }
}

/**
 * The final S3 FileSystem implementation using the BaseCloudFs wrapper.
 */
export class S3FileSystem extends BaseCloudFs {
  constructor(config: S3Config) {
    super("s3", new RawS3Fs(config), config.remotePrefix || "");
  }

  async checkConnect(callbackFunc?: any): Promise<boolean> {
    try {
      const ok = await (this.rawFs as RawS3Fs).checkConnect();
      if (!ok) throw Error("Connection failed");
    } catch (err: any) {
      console.debug(err);
      callbackFunc?.(err);
      return false;
    }
    return await this.checkConnectCommonOps(callbackFunc);
  }
}
