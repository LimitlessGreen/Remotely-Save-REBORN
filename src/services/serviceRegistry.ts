import { S3Service } from "./s3/S3Service";
import { AzureService } from "./azure/AzureService";
import { GoogleDriveService } from "./googledrive/GoogleDriveService";
import { OneDriveService } from "./onedrive/OneDriveService";
import { BoxService } from "./box/BoxService";
import { PCloudService } from "./pcloud/PCloudService";
import { YandexDiskService } from "./yandex/YandexService";
import { InternxtService } from "./internxt/InternxtService";
import { KoofrService } from "./koofr/KoofrService";
import { DropboxService } from "./dropbox/DropboxService";
import { WebdavService } from "./webdav/WebdavService";
import { WebdisService } from "./webdis/WebdisService";
import type { CloudService } from "./serviceInterface";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Registry for all cloud storage services.
 */
export const SERVICES: CloudService[] = [
  GoogleDriveService,
  OneDriveService,
  BoxService,
  PCloudService,
  YandexDiskService,
  InternxtService,
  KoofrService,
  S3Service,
  DropboxService,
  WebdavService,
  WebdisService,
  AzureService,
];

export function getServiceById(id: string): CloudService | undefined {
  return SERVICES.find(s => s.id === id || (id === "onedrivefull" && s.id === "onedrive"));
}

export function getServiceByCallbackId(callbackId: string): CloudService | undefined {
  return SERVICES.find(s => s.callbackId === callbackId);
}
