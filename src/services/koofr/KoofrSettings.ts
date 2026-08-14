import { Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { DEFAULT_KOOFR_CONFIG, generateAuthUrl } from "./KoofrFileSystem";

export class KoofrSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "koofr-settings-section" });
    root.toggleClass(
      "koofr-hide",
      this.plugin.settings.serviceType !== "koofr"
    );

    this.addHeader(root, this.t("settings_koofr"));
    this.addDescription(root, this.t("settings_koofr_disclaimer1"));

    this.addDirectorySetting(root);
    this.addAuthSection(root);
  }

  private addDirectorySetting(el: HTMLElement) {
    let dir = this.plugin.settings.koofr.remoteBaseDir || "";
    new Setting(el)
      .setName(this.t("settings_remotebasedir"))
      .addText((text) => text.setValue(dir).onChange((v) => (dir = v.trim())))
      .addButton((btn) =>
        btn.setButtonText(this.t("confirm")).onClick(async () => {
          this.plugin.settings.koofr.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice(this.t("modal_remotebasedir_notice"));
        })
      );
  }

  private addAuthSection(el: HTMLElement) {
    const area = el.createDiv();
    const refresh = () => {
      area.empty();
      const linked = !!this.plugin.settings.koofr.refreshToken;
      new Setting(area)
        .setName(
          linked
            ? this.t("settings_koofr_revoke")
            : this.t("settings_koofr_auth")
        )
        .addButton((btn) =>
          btn
            .setButtonText(
              linked
                ? this.t("settings_koofr_revoke_button")
                : this.t("settings_koofr_auth_button")
            )
            .onClick(async () => {
              if (linked) {
                this.plugin.settings.koofr = { ...DEFAULT_KOOFR_CONFIG };
                await this.plugin.saveSettings();
                refresh();
              } else {
                window.open(
                  generateAuthUrl(this.plugin.settings.koofr.api, true)
                );
              }
            })
        );
    };
    refresh();
  }
}
