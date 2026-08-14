/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Interface for encryption providers.
 */
export interface EncryptionProvider {
  readonly id: string;

  encryptContent(content: ArrayBuffer): Promise<ArrayBuffer>;
  decryptContent(content: ArrayBuffer): Promise<ArrayBuffer>;

  encryptName(name: string): Promise<string>;
  decryptName(name: string): Promise<string>;

  getSizeFromOrigToEnc(size: number): number;

  isFolderAware(): boolean;

  closeResources?(): void;
}
