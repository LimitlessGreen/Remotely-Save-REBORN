import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { DEFAULT_GOOGLEDRIVE_CONFIG } from "../../baseTypes";

export class GoogleDriveSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "googledrive-settings-section" });
    root.toggleClass("googledrive-hide", this.plugin.settings.serviceType !== "googledrive");

    this.addHeader(root, this.t("settings_googledrive"));
    this.addDescription(root, this.t("settings_googledrive_disclaimer1"));

    this.addDirectorySetting(root);
    this.addAuthSection(root);
  }

  private addDirectorySetting(el: HTMLElement) {
    let dir = this.plugin.settings.googledrive.remoteBaseDir || "";
    new Setting(el)
      .setName(this.t("settings_remotebasedir"))
      .addText(text => text
        .setPlaceholder(this.app.vault.getName())
        .setValue(dir)
        .onChange(v => dir = v.trim())
      )
      .addButton(btn => btn
        .setButtonText(this.t("confirm"))
        .onClick(async () => {
          this.plugin.settings.googledrive.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice(this.t("modal_remotebasedir_notice"));
        })
      );
  }

  private addAuthSection(el: HTMLElement) {
    const area = el.createDiv();
    const refresh = () => {
      area.empty();
      const linked = !!this.plugin.settings.googledrive.refreshToken;

      new Setting(area)
        .setName(linked ? this.t("settings_googledrive_revoke") : this.t("settings_googledrive_auth"))
        .addButton(btn => btn
          .setButtonText(linked ? this.t("settings_googledrive_revoke_button") : this.t("settings_googledrive_auth_button"))
          .onClick(async () => {
            if (linked) {
              this.plugin.settings.googledrive = { ...DEFAULT_GOOGLEDRIVE_CONFIG };
              await this.plugin.saveSettings();
              refresh();
            } else {
              this.showAuthModal(refresh);
            }
          })
        );
    };
    refresh();
  }

  private showAuthModal(onDone: () => void) {
    // Logic for auth modal...
    new Notice("Auth flow placeholder");
    onDone();
  }
}
