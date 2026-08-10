import { type CipherMethodType } from "../../core/baseTypes";
import { type EncryptionProvider } from "./interface";
import { OpenSSLEncryptionProvider } from "./providers/openssl";
import { RCloneEncryptionProvider } from "./providers/rclone";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Factory for creating encryption providers.
 */
export function getEncryptionProvider(
  method: CipherMethodType,
  password: string
): EncryptionProvider | undefined {
  if (password === "") {
    return undefined;
  }

  switch (method) {
    case "openssl-base64":
      return new OpenSSLEncryptionProvider(password);
    case "rclone-base64":
      return new RCloneEncryptionProvider(password);
    default:
      return undefined;
  }
}
