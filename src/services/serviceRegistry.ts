import { GoogleDriveService } from "./googledrive";
import { OneDriveService } from "./onedrive";
import { BoxService } from "./box";
import { PCloudService } from "./pcloud";
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
];

export function getServiceById(id: string): CloudService | undefined {
  return SERVICES.find(s => s.id === id || (id === "onedrivefull" && s.id === "onedrive"));
}

export function getServiceByCallbackId(callbackId: string): CloudService | undefined {
  return SERVICES.find(s => s.callbackId === callbackId);
}
