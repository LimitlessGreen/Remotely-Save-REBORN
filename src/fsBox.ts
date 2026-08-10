/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Box storage service
 */

import { FakeFs } from "./fsAll";
import type { BoxConfig } from "./baseTypesAdvanced";

export const DEFAULT_BOX_CONFIG: BoxConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  kind: "box",
};

export class FakeFsBox extends FakeFs {
  kind: "box" = "box";
}

export async function sendAuthReq(...) {}
export async function setConfigBySuccessfullAuthInplace(...) {}
