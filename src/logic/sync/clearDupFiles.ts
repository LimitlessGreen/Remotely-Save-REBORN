import type { FakeFsLocal } from "../../core/fs/fsLocal";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Utility to identify and clear duplicate conflict files.
 */

export const getDupFiles = async (fsLocal: FakeFsLocal) => {
  const allFilesAndFolders = await fsLocal.walk();

  // Pattern for our new conflict files: "name (Conflict - device - timestamp).ext"
  // Also support the old ".dup" pattern for compatibility during migration
  const conflictPattern = /\(Conflict - .* - .*\)/;

  const filesToBeRemoved = allFilesAndFolders
    .map((f) => f.keyRaw)
    .filter(
      (key) =>
        !key.endsWith("/") &&
        (key.includes(".dup") || conflictPattern.test(key))
    );

  return filesToBeRemoved;
};

export const clearDupFiles = async (
  filesToBeRemoved: string[],
  fsLocal: FakeFsLocal
) => {
  await Promise.all(filesToBeRemoved.map(async (f) => await fsLocal.rm(f)));
};
