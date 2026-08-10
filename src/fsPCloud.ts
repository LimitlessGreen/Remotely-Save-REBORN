import { FakeFs } from "./fsAll";
import type { PCloudConfig } from "./baseTypesAdvanced";

export const DEFAULT_PCLOUD_CONFIG: PCloudConfig = {
  accessToken: "",
  hostname: "api.pcloud.com",
  locationid: 1,
  kind: "pcloud",
  emptyFile: "skip",
};

export class FakeFsPCloud extends FakeFs {
  kind: "pcloud" = "pcloud";
}

export async function generateAuthUrl() {}
export async function sendAuthReq() {}
export async function setConfigBySuccessfullAuthInplace() {}
