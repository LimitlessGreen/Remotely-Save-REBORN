import type { RemotelySavePluginSettings } from "../baseTypes";
import type { FakeFs } from "./fsAll";
import { S3FileSystem } from "../../services/s3/S3FileSystem";
import { WebdavFileSystem } from "../../services/webdav/WebdavFileSystem";
import { NutStoreFileSystem } from "../../services/webdav/NutStoreFileSystem";
import { DropboxFileSystem } from "../../services/dropbox/DropboxFileSystem";
import { WebdisFileSystem } from "../../services/webdis/WebdisFileSystem";
import { getServiceById } from "../../services/serviceRegistry";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Central factory for obtaining a filesystem client.
 */
export function getClient(
  settings: RemotelySavePluginSettings,
  vaultName: string,
  saveUpdatedConfigFunc: () => Promise<any>,
  manifest?: { id: string; version: string }
): FakeFs {
  if (settings.serviceType === "s3") {
    return new S3FileSystem(settings.s3);
  }
  if (settings.serviceType === "webdav") {
    return new WebdavFileSystem(settings.webdav, vaultName, saveUpdatedConfigFunc);
  }
  if (settings.serviceType === "nutstore") {
    return new NutStoreFileSystem(settings.webdav, vaultName, saveUpdatedConfigFunc);
  }
  if (settings.serviceType === "dropbox") {
    return new DropboxFileSystem(settings.dropbox, vaultName, saveUpdatedConfigFunc);
  }
  if (settings.serviceType === "webdis") {
    return new WebdisFileSystem(settings.webdis);
  }

  const service = getServiceById(settings.serviceType);
  if (service) {
    // For now, we pass the proxy plugin object if needed, but let's assume standard access
    return service.getProvider({ settings, saveSettings: saveUpdatedConfigFunc, manifest } as any, { vault: { getName: () => vaultName } } as any);
  }

  throw Error(`ServiceType=${settings.serviceType} not supported.`);
}
