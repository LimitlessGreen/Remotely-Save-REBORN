import { FakeFs } from "./fsAll";
import type { KoofrConfig } from "./baseTypesAdvanced";

export const DEFAULT_KOOFR_CONFIG: KoofrConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  scope: "",
  api: "",
  mountID: "",
  kind: "koofr",
};

export class FakeFsKoofr extends FakeFs {
  kind: "koofr" = "koofr";
}

export async function sendAuthReq() {}
export async function setConfigBySuccessfullAuthInplace() {}
