/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Main synchronization engine
 */

import { type App } from "obsidian";
import PQueue from "p-queue";
import type { RemotelySavePluginSettings, SyncTriggerSourceType, MixedEntity, Entity } from "../../core/baseTypes";
import type { InternalDBs } from "../../core/storage/localdb";
import { getClient } from "../../core/fs/fsGetter";
import { FakeFsLocal } from "../../core/fs/fsLocal";
import { FakeFsEncrypt } from "../../core/fs/fsEncrypt";
import * as SmartSyncLogic from "./smartSync";

export async function syncer(
  app: App,
  db: InternalDBs,
  settings: RemotelySavePluginSettings,
  vaultName: string,
  saveUpdatedConfigFunc: () => Promise<any>,
  triggerSource: SyncTriggerSourceType,
  notice?: any,
  manifest?: { id: string; version: string }
) {
  console.info(`Syncer started (Apache 2.0 implementation)`);

  try {
    const fsLocal = new FakeFsLocal(
      app.vault,
      settings.syncConfigDir ?? false,
      settings.syncBookmarks ?? false,
      app.vault.configDir,
      "remotely-save", // plugin ID
      undefined, // profiler
      settings.deleteToWhere ?? "system",
      settings.onlyAllowPaths ?? []
    );
    const fsRemote = getClient(settings, vaultName, saveUpdatedConfigFunc, manifest);
    const fsEncrypt = new FakeFsEncrypt(fsRemote, settings.password, settings.encryptionMethod ?? "unknown");

    // 1. Fetch metadata from both sides
    notice?.(triggerSource, "Fetching metadata...");
    const [localEntities, remoteEntities] = await Promise.all([
      fsLocal.walk(),
      fsEncrypt.walk()
    ]);

    // 2. Load previous sync records from DB
    notice?.(triggerSource, "Generating sync plan...");
    // (Simplified for now)
    const prevSyncRecords: Record<string, Entity> = {};

    // 3. Build mixed entities and decide actions
    const mixedEntities: MixedEntity[] = buildMixedEntities(localEntities, remoteEntities, prevSyncRecords, settings);

    // 4. Execute operations
    if (mixedEntities.length > 0) {
      notice?.(triggerSource, `Exchanging ${mixedEntities.length} items...`);
    }
    const queue = new PQueue({ concurrency: settings.concurrency || 5 });

    for (const mixed of mixedEntities) {
      queue.add(async () => {
        await processMixedEntity(mixed, fsLocal, fsEncrypt, db, settings);
      });
    }

    await queue.onIdle();
    fsEncrypt.closeResources();
    console.info(`Syncer finished successfully`);
  } catch (error) {
    console.error(`Sync failed in syncer:`, error);
    throw error;
  }
}

function buildMixedEntities(local: Entity[], remote: Entity[], prev: Record<string, Entity>, settings: RemotelySavePluginSettings): MixedEntity[] {
    const mixed: Record<string, MixedEntity> = {};
    console.info(`building mixed entities for ${local.length} local and ${remote.length} remote`);

    for (const l of local) {
      mixed[l.keyRaw] = { key: l.keyRaw, local: l };
    }

    for (const r of remote) {
      if (mixed[r.keyRaw]) {
        mixed[r.keyRaw].remote = r;
      } else {
        mixed[r.keyRaw] = { key: r.keyRaw, remote: r };
      }
    }

    const result = Object.values(mixed).map(m => {
      if (m.local && !m.remote) {
        m.decision = "local_is_created_then_push";
        console.debug(`[SYNC] ${m.key}: Local exists, Remote missing -> PUSH`);
      } else if (!m.local && m.remote) {
        m.decision = "remote_is_created_then_pull";
        console.debug(`[SYNC] ${m.key}: Remote exists, Local missing -> PULL`);
      } else if (m.local && m.remote) {
        if (m.local.mtimeCli! > m.remote.mtimeSvr!) {
          m.decision = "local_is_modified_then_push";
          console.debug(`[SYNC] ${m.key}: Local is newer (${m.local.mtimeCli}) than Remote (${m.remote.mtimeSvr}) -> PUSH`);
        } else if (m.local.mtimeCli! < m.remote.mtimeSvr!) {
          m.decision = "remote_is_modified_then_pull";
          console.debug(`[SYNC] ${m.key}: Remote is newer (${m.remote.mtimeSvr}) than Local (${m.local.mtimeCli}) -> PULL`);
        } else {
          m.decision = "equal";
          // console.debug(`[SYNC] ${m.key}: Equal -> SKIP`);
        }
      }
      return m;
    }).filter(m => m.decision !== "equal");
    console.info(`decision count: ${result.length}`);
    return result;
}

async function processMixedEntity(mixed: MixedEntity, localFs: FakeFsLocal, remoteFs: FakeFsEncrypt, db: InternalDBs, settings: RemotelySavePluginSettings) {
    if (mixed.decision === "local_is_created_then_push" || mixed.decision === "local_is_modified_then_push") {
      console.info(`Pushing ${mixed.key}...`);
      if (mixed.key.endsWith("/")) {
        await remoteFs.mkdir(mixed.key);
      } else {
        const content = await localFs.readFile(mixed.key);
        await remoteFs.writeFile(mixed.key, content, mixed.local!.mtimeCli!, mixed.local!.ctimeCli || mixed.local!.mtimeCli!);
      }
    } else if (mixed.decision === "remote_is_created_then_pull" || mixed.decision === "remote_is_modified_then_pull") {
      console.info(`Pulling ${mixed.key}...`);
      if (mixed.key.endsWith("/")) {
        await localFs.mkdir(mixed.key);
      } else {
        const content = await remoteFs.readFile(mixed.key);
        await localFs.writeFile(mixed.key, content, mixed.remote!.mtimeSvr!, mixed.remote!.mtimeSvr!);
      }
    }
}
