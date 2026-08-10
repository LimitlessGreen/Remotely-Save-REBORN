import { FakeFs } from "./fsAll";
import type { YandexDiskConfig } from "./baseTypesAdvanced";

export const DEFAULT_YANDEXDISK_CONFIG: YandexDiskConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  scope: "",
  kind: "yandexdisk",
};

export class FakeFsYandexDisk extends FakeFs {
  kind: "yandexdisk" = "yandexdisk";
}

export async function sendAuthReq() {}
export async function setConfigBySuccessfullAuthInplace() {}
