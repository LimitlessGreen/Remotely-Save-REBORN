import { FakeFs } from "./fsAll";
import type { AzureBlobStorageConfig } from "./baseTypesAdvanced";

export const DEFAULT_AZUREBLOBSTORAGE_CONFIG: AzureBlobStorageConfig = {
  containerSasUrl: "",
  containerName: "",
  remotePrefix: "",
  generateFolderObject: false,
  partsConcurrency: 5,
  kind: "azureblobstorage",
};

export class FakeFsAzureBlobStorage extends FakeFs {
  kind: "azureblobstorage" = "azureblobstorage";
}
