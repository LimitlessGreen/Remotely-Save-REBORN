import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { DEFAULT_BOX_CONFIG, generateAuthUrl } from "./fsBox";

export class BoxSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "box-settings-section" });
    root.toggleClass("box-hide", this.plugin.settings.serviceType !== "box");

    this.addHeader(root, this.t("settings_box"));
    this.addDescription(root, this.t("settings_box_disclaimer1"));

    this.addDirectorySetting(root);
    this.addAuthSection(root);
  }

  private addDirectorySetting(el: HTMLElement) {
    let dir = this.plugin.settings.box.remoteBaseDir || "";
    new Setting(el)
      .setName(this.t("settings_remotebasedir"))
      .addText(text => text
        .setValue(dir)
        .onChange(v => dir = v.trim())
      )
      .addButton(btn => btn
        .setButtonText(this.t("confirm"))
        .onClick(async () => {
          this.plugin.settings.box.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice(this.t("modal_remotebasedir_notice"));
        })
      );
  }

  private addAuthSection(el: HTMLElement) {
    const area = el.createDiv();
    const refresh = () => {
      area.empty();
      const linked = !!this.plugin.settings.box.refreshToken;
      new Setting(area)
        .setName(linked ? this.t("settings_box_revoke") : this.t("settings_box_auth"))
        .addButton(btn => btn
          .setButtonText(linked ? this.t("settings_box_revoke_button") : this.t("settings_box_auth_button"))
          .onClick(async () => {
            if (linked) {
              this.plugin.settings.box = { ...DEFAULT_BOX_CONFIG };
              await this.plugin.saveSettings();
              refresh();
            } else {
              window.open(generateAuthUrl());
            }
          })
        );
    };
    refresh();
  }
}
