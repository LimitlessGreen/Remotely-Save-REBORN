import { S3Service } from "./s3/S3Service";
import { AzureService } from "./azure/AzureService";
import { OneDriveService } from "./onedrive/OneDriveService";
import { BoxService } from "./box/BoxService";
import { PCloudService } from "./pcloud/PCloudService";
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
  OneDriveService,
  BoxService,
  PCloudService,
  InternxtService,
  KoofrService,
  S3Service,
  DropboxService,
  WebdavService,
  WebdisService,
  AzureService,
].filter(s => {
  if (s === undefined) {
    console.warn("A service in registry is undefined! This is likely a circular dependency issue.");
    return false;
  }
  if (s.id === undefined) {
    console.error("A service in registry has an undefined id!", s);
    return false;
  }
  return true;
});

export function getServiceById(id: string): CloudService | undefined {
  if (SERVICES.some(s => s === undefined)) {
    console.warn("Some services in registry are undefined! This usually indicates a circular dependency.");
    console.debug("SERVICES array:", SERVICES);
  }
  return SERVICES.find(s => s && (s.id === id || (id === "onedrivefull" && s.id === "onedrive")));
}

export function getServiceByCallbackId(callbackId: string): CloudService | undefined {
  return SERVICES.find(s => s && s.callbackId === callbackId);
}
