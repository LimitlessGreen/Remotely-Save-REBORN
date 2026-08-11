import { type App, Setting } from "obsidian";
import type RemotelySavePlugin from "../main";
import type { TransItemType } from "../core/i18n/i18n";

/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Interface for modular settings sections.
 */
export interface SettingsSection {
  render(containerEl: HTMLElement): void;
}

export abstract class BaseSettingsManager implements SettingsSection {
  constructor(
    protected plugin: RemotelySavePlugin,
    protected app: App,
    protected t: (x: TransItemType, vars?: any) => string
  ) {}

  abstract render(containerEl: HTMLElement): void;

  protected addHeader(el: HTMLElement, text: string) {
    el.createEl("h2", { text });
  }

  protected addDescription(el: HTMLElement, text: string, className = "settings-long-desc") {
    el.createDiv({ cls: className }).createEl("p", { text });
  }
}
