import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { DEFAULT_PCLOUD_CONFIG, generateAuthUrl } from "./PCloudFileSystem";

export class PCloudSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "pcloud-settings-section" });
    root.toggleClass("pcloud-hide", this.plugin.settings.serviceType !== "pcloud");

    this.addHeader(root, this.t("settings_pcloud"));
    this.addDescription(root, this.t("settings_pcloud_disclaimer1"));

    this.addDirectorySetting(root);
    this.addRegionSetting(root);
    this.addAuthSection(root);
  }

  private addRegionSetting(el: HTMLElement) {
    new Setting(el)
      .setName(this.t("settings_pcloud_region"))
      .setDesc(this.t("settings_pcloud_region_desc"))
      .addDropdown(dropdown => dropdown
        .addOption("1", "United States (api.pcloud.com)")
        .addOption("2", "Europe (eapi.pcloud.com)")
        .setValue(String(this.plugin.settings.pcloud.locationid || "1"))
        .onChange(async (value) => {
          const locId = parseInt(value) as 1 | 2;
          this.plugin.settings.pcloud.locationid = locId;
          this.plugin.settings.pcloud.hostname = locId === 2 ? "eapi.pcloud.com" : "api.pcloud.com";
          await this.plugin.saveSettings();
        })
      );
  }

  private addDirectorySetting(el: HTMLElement) {
    let dir = this.plugin.settings.pcloud.remoteBaseDir || "";
    new Setting(el)
      .setName(this.t("settings_remotebasedir"))
      .addText(text => text
        .setValue(dir)
        .onChange(v => dir = v.trim())
      )
      .addButton(btn => btn
        .setButtonText(this.t("confirm"))
        .onClick(async () => {
          this.plugin.settings.pcloud.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice(this.t("modal_remotebasedir_notice"));
        })
      );
  }

  private addAuthSection(el: HTMLElement) {
    const area = el.createDiv();
    const refresh = () => {
      area.empty();
      const linked = !!this.plugin.settings.pcloud.accessToken;
      new Setting(area)
        .setName(linked ? this.t("settings_pcloud_revoke") : this.t("settings_pcloud_auth"))
        .addButton(btn => btn
          .setButtonText(linked ? this.t("settings_pcloud_revoke_button") : this.t("settings_pcloud_auth_button"))
          .onClick(async () => {
            if (linked) {
              this.plugin.settings.pcloud = { ...DEFAULT_PCLOUD_CONFIG };
              await this.plugin.saveSettings();
              refresh();
            } else {
              const { authUrl } = await generateAuthUrl(this.plugin.settings.pcloud.locationid);
              window.open(authUrl);
            }
          })
        );
    };
    refresh();
  }
}
