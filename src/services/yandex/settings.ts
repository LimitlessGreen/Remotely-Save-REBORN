import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { DEFAULT_YANDEXDISK_CONFIG, generateAuthUrl } from "./fsYandexDisk";

export class YandexDiskSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "yandex-settings-section" });
    root.toggleClass("yandex-hide", this.plugin.settings.serviceType !== "yandexdisk");

    this.addHeader(root, this.t("settings_yandexdisk"));
    this.addDescription(root, this.t("settings_yandexdisk_disclaimer1"));

    this.addDirectorySetting(root);
    this.addAuthSection(root);
  }

  private addDirectorySetting(el: HTMLElement) {
    let dir = this.plugin.settings.yandexdisk.remoteBaseDir || "";
    new Setting(el)
      .setName(this.t("settings_remotebasedir"))
      .addText(text => text
        .setValue(dir)
        .onChange(v => dir = v.trim())
      )
      .addButton(btn => btn
        .setButtonText(this.t("confirm"))
        .onClick(async () => {
          this.plugin.settings.yandexdisk.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice(this.t("modal_remotebasedir_notice"));
        })
      );
  }

  private addAuthSection(el: HTMLElement) {
    const area = el.createDiv();
    const refresh = () => {
      area.empty();
      const linked = !!this.plugin.settings.yandexdisk.refreshToken;
      new Setting(area)
        .setName(linked ? this.t("settings_yandexdisk_revoke") : this.t("settings_yandexdisk_auth"))
        .addButton(btn => btn
          .setButtonText(linked ? this.t("settings_yandexdisk_revoke_button") : this.t("settings_yandexdisk_auth_button"))
          .onClick(async () => {
            if (linked) {
              this.plugin.settings.yandexdisk = { ...DEFAULT_YANDEXDISK_CONFIG };
              await this.plugin.saveSettings();
              refresh();
            } else {
              window.open(generateAuthUrl(true));
            }
          })
        );
    };
    refresh();
  }
}
