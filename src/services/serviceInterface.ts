import { type App } from "obsidian";
import type RemotelySavePlugin from "../main";
import type { FakeFs } from "../core/fs/fsAll";
import type { SettingsSection } from "../ui/settingsManager";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Interface for modular cloud services.
 */
export interface CloudService {
  readonly id: string;
  readonly callbackId?: string;

  getProvider(plugin: RemotelySavePlugin, app: App): FakeFs;
  getSettings(plugin: RemotelySavePlugin, app: App, t: any): SettingsSection;
  handleCallback?(plugin: RemotelySavePlugin, params: Record<string, string>): Promise<void>;
}
