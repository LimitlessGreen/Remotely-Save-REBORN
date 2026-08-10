import { FakeFs } from "./fsAll";
import type { OnedriveFullConfig } from "./baseTypesAdvanced";

export const DEFAULT_ONEDRIVEFULL_CONFIG: OnedriveFullConfig = {
  accessToken: "",
  clientID: "",
  authority: "",
  refreshToken: "",
  accessTokenExpiresInSeconds: 0,
  accessTokenExpiresAtTime: 0,
  deltaLink: "",
  username: "",
  emptyFile: "skip",
  kind: "onedrivefull",
};

export class FakeFsOnedriveFull extends FakeFs {
  kind: "onedrivefull" = "onedrivefull";
}

export async function sendAuthReq() {}
export async function setConfigBySuccessfullAuthInplace() {}
