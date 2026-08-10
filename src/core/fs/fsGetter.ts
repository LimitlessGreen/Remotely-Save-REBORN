import type { RemotelySavePluginSettings } from "../baseTypes";
import type { FakeFs } from "./fsAll";
import { FakeFsS3 } from "../../services/s3/provider";
import { FakeFsWebdav } from "../../services/webdav/provider";
import { FakeFsNutStore } from "../../services/webdav/nutstore";
import { FakeFsDropbox } from "../../services/dropbox/provider";
import { FakeFsWebdis } from "../../services/webdis/provider";
import { getServiceById } from "../../services/serviceRegistry";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Central factory for obtaining a filesystem client.
 */
export function getClient(
  settings: RemotelySavePluginSettings,
  vaultName: string,
  saveUpdatedConfigFunc: () => Promise<any>
): FakeFs {
  const service = getServiceById(settings.serviceType);
  if (service) {
    // For now, we pass the proxy plugin object if needed, but let's assume standard access
    return service.getProvider({ settings, saveSettings: saveUpdatedConfigFunc } as any, { vault: { getName: () => vaultName } } as any);
  }

  throw Error(`ServiceType=${settings.serviceType} not supported.`);
}
