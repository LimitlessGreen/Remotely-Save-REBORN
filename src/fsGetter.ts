import type { RemotelySavePluginSettings } from "./baseTypes";
import type { FakeFs } from "./fsAll";
import { FakeFsS3 } from "./fsS3";
import { FakeFsWebdav } from "./fsWebdav";
import { FakeFsNutStore } from "./fsNutStore";
import { FakeFsDropbox } from "./fsDropbox";
import { FakeFsWebdis } from "./fsWebdis";
import { getServiceById } from "./services/serviceRegistry";

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
