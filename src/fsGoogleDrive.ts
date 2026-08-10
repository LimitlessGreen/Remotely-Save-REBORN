/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Google Drive storage service
 */

import { FakeFs } from "./fsAll";
import type { GoogleDriveConfig } from "./baseTypesAdvanced";

export const DEFAULT_GOOGLEDRIVE_CONFIG: GoogleDriveConfig = {
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresInMs: 0,
  accessTokenExpiresAtTimeMs: 0,
  scope: "https://www.googleapis.com/auth/drive.file",
  kind: "googledrive",
};

export class FakeFsGoogleDrive extends FakeFs {
  kind: "googledrive" = "googledrive";
  // TBD: Implementation
}
