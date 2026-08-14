import type { Entity } from "../baseTypes";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * A simplified filesystem interface that works with absolute remote paths.
 * Implementation classes don't need to worry about vault prefixes.
 */
export interface RawFs {
  /**
   * List files starting from the given full path.
   * @param fullPath The remote path to list from.
   * @param partial If true, return only a small subset of results.
   */
  walk(fullPath: string, partial: boolean): Promise<Entity[]>;

  /**
   * Get metadata for a file at the given full path.
   */
  stat(fullPath: string): Promise<Entity>;

  /**
   * Create a directory at the given full path.
   */
  mkdir(fullPath: string, mtime?: number, ctime?: number): Promise<Entity>;

  /**
   * Write file content at the given full path.
   */
  writeFile(
    fullPath: string,
    content: ArrayBuffer,
    mtime: number,
    ctime: number
  ): Promise<Entity>;

  /**
   * Read file content from the given full path.
   */
  readFile(fullPath: string, versionId?: string): Promise<ArrayBuffer>;

  /**
   * Delete a file or directory at the given full path.
   */
  rm(fullPath: string, versionId?: string): Promise<void>;

  /**
   * List versions of an object. Optional.
   */
  listVersions?(fullPath: string): Promise<Entity[]>;

  /**
   * Rename a file or directory. Optional.
   */
  rename?(fullPath1: string, fullPath2: string): Promise<void>;
}
