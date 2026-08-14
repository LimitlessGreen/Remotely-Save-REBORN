import { type App, Modal, Notice, Setting } from "obsidian";
import { FakeFsLocal } from "../../core/fs/fsLocal";
import type { TransItemType } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import { stringToFragment } from "../../utils/misc";
import { clearDupFiles, getDupFiles } from "./clearDupFiles";

class ClearDupFilesModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly t: (x: TransItemType, vars?: Record<string, string>) => string;
  readonly files: string[];
  readonly fsLocal: FakeFsLocal;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    t: (x: TransItemType, vars?: Record<string, string>) => string,
    files: string[],
    fsLocal: FakeFsLocal
  ) {
    super(app);
    this.plugin = plugin;
    this.t = t;
    this.files = files;
    this.fsLocal = fsLocal;
  }

  async onOpen() {
    const t = this.t;
    const { contentEl } = this;

    contentEl.createEl("p", {
      text: t("modal_cleardupfiles_warning"),
    });

    contentEl.createEl("pre").createEl("code", {
      text: this.files.join("\n"),
    });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText(t("modal_cleardupfiles_warning_confirm"));
        button.onClick(async () => {
          await clearDupFiles(this.files, this.fsLocal);
          new Notice(t("modal_cleardupfiles_warning_finished"));
          this.close();
        });
      })
      .addButton((button) => {
        button.setButtonText(t("goback"));
        button.onClick(() => {
          this.close();
        });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export const generateClearDupFilesSettingsPart = (
  containerEl: HTMLElement,
  t: (x: TransItemType, vars?: Record<string, string>) => string,
  app: App,
  plugin: RemotelySavePlugin
) => {
  new Setting(containerEl)
    .setName(t("settings_cleardupfiles"))
    .setDesc(stringToFragment(t("settings_cleardupfiles_desc")))
    .addButton(async (button) => {
      button.setButtonText(t("settings_cleardupfiles_button"));
      button.onClick(async () => {
        const fsLocal = new FakeFsLocal(
          app.vault,
          plugin.settings.syncConfigDir ?? false,
          plugin.settings.syncBookmarks ?? false,
          app.vault.configDir,
          plugin.manifest.id,
          undefined,
          plugin.settings.deleteToWhere ?? "system",
          plugin.settings.onlyAllowPaths ?? []
        );

        const files = await getDupFiles(fsLocal);

        if (files.length === 0) {
          new Notice("No duplicate conflict files found.");
          return;
        }

        const modal = new ClearDupFilesModal(app, plugin, t, files, fsLocal);
        modal.open();
      });
    });
};
