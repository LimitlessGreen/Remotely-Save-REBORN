import { LCS, mergeDigIn } from "node-diff3";
import type { Entity } from "../../core/baseTypes";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Smart Sync Logic for Markdown and Conflict Handling
 */

export const MERGABLE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

/**
 * Checks if an entity is a Markdown file and within size limits for merging.
 */
export function isMergable(entity: Entity): boolean {
  if (!entity.keyRaw) return false;
  const isMarkdown =
    entity.keyRaw.toLowerCase().endsWith(".md") ||
    entity.keyRaw.toLowerCase().endsWith(".markdown");
  const isSmallEnough = (entity.sizeRaw ?? 0) <= MERGABLE_SIZE_LIMIT;
  const isNotFolder = !entity.keyRaw.endsWith("/");
  return isMarkdown && isSmallEnough && isNotFolder;
}

/**
 * Generates a Longest Common Subsequence (LCS) text from two strings.
 * This is used as a "fake base" for 2-way merging.
 */
function getLCSText(a: string, b: string): string {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  let lcsResult = LCS(linesA, linesB);

  const commonLines: string[] = [];
  while (lcsResult && lcsResult.buffer1index !== -1) {
    commonLines.unshift(linesA[lcsResult.buffer1index]);
    lcsResult = (lcsResult as { chain: typeof lcsResult }).chain;
  }

  return commonLines.join("\n");
}

/**
 * Per-line merge with conflict markers.
 */
function internalMerge(a: string, o: string, b: string): string {
  const { result } = mergeDigIn(a, o, b, {
    stringSeparator: /\n/,
  });
  return result.join("\n");
}

/**
 * Performs a 2-way merge by calculating an LCS base first.
 */
export async function twoWayMerge(a: string, b: string): Promise<string> {
  const base = getLCSText(a, b);
  return internalMerge(a, base, b);
}

/**
 * Performs a standard 3-way merge.
 */
export async function threeWayMerge(
  a: string,
  b: string,
  base: string
): Promise<string> {
  return internalMerge(a, base, b);
}

/**
 * Generates a unique conflict filename using device name and timestamp.
 */
export function getFileRenameForDup(key: string, deviceName: string): string {
  if (!key || key === "/" || key.endsWith("/")) {
    throw new Error(`Cannot rename key: ${key}`);
  }

  const segs = key.split("/");
  const fileName = segs.pop();
  if (fileName === undefined) {
    throw new Error(`Cannot rename key: ${key}`);
  }
  const lastDotIndex = fileName.lastIndexOf(".");

  let baseName = fileName;
  let ext = "";

  if (lastDotIndex !== -1 && lastDotIndex !== 0) {
    baseName = fileName.substring(0, lastDotIndex);
    ext = fileName.substring(lastDotIndex);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const newFileName = `${baseName} (Conflict - ${deviceName} - ${timestamp})${ext}`;

  segs.push(newFileName);
  return segs.join("/");
}
