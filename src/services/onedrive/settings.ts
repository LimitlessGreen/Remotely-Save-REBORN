import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { DEFAULT_ONEDRIVEFULL_CONFIG, getAuthUrlAndVerifier, sendAuthReq, setConfigBySuccessfullAuthInplace } from "./fsOnedriveFull";
import { DEFAULT_ONEDRIVE_CONFIG } from "../../baseTypes";

export class OneDriveSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const isFull = this.plugin.settings.serviceType === "onedrivefull";
    const root = containerEl.createDiv({ cls: "onedrive-settings-section" });
    root.toggleClass("onedrive-hide", !["onedrive", "onedrivefull"].includes(this.plugin.settings.serviceType));

    this.addHeader(root, isFull ? this.t("settings_onedrivefull") : this.t("settings_onedrive"));
    this.addDescription(root, isFull ? this.t("settings_onedrivefull_disclaimer1") : this.t("settings_onedrive_disclaimer1"));

    this.addDirectorySetting(root, isFull);
    this.addAuthSection(root, isFull);
  }

  private addDirectorySetting(el: HTMLElement, isFull: boolean) {
    const config = isFull ? this.plugin.settings.onedrivefull : this.plugin.settings.onedrive;
    let dir = config.remoteBaseDir || "";

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
          config.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice(this.t("modal_remotebasedir_notice"));
        })
      );
  }

  private addAuthSection(el: HTMLElement, isFull: boolean) {
    const area = el.createDiv();
    const config = isFull ? this.plugin.settings.onedrivefull : this.plugin.settings.onedrive;

    const refresh = () => {
      area.empty();
      const linked = !!config.refreshToken;

      new Setting(area)
        .setName(linked ? (isFull ? this.t("settings_onedrivefull_revoke") : this.t("settings_onedrive_revoke")) : (isFull ? this.t("settings_onedrivefull_auth") : this.t("settings_onedrive_auth")))
        .addButton(btn => btn
          .setButtonText(linked ? (isFull ? this.t("settings_onedrivefull_revoke_button") : this.t("settings_onedrive_revoke_button")) : (isFull ? this.t("settings_onedrivefull_auth_button") : this.t("settings_onedrive_auth_button")))
          .onClick(async () => {
            if (linked) {
              if (isFull) this.plugin.settings.onedrivefull = { ...DEFAULT_ONEDRIVEFULL_CONFIG };
              else this.plugin.settings.onedrive = { ...DEFAULT_ONEDRIVE_CONFIG };
              await this.plugin.saveSettings();
              refresh();
            } else {
              this.showAuthModal(isFull, refresh);
            }
          })
        );
    };
    refresh();
  }

  private async showAuthModal(isFull: boolean, onDone: () => void) {
    const config = isFull ? this.plugin.settings.onedrivefull : this.plugin.settings.onedrive;
    const { authUrl, verifier } = await getAuthUrlAndVerifier(config.clientID, config.authority);

    const modal = new Modal(this.app);
    modal.titleEl.setText("OneDrive Authorization");
    modal.contentEl.createEl("a", { href: authUrl, text: "Authorize via Browser" });

    let code = "";
    new Setting(modal.contentEl)
      .setName("Paste result code")
      .addText(t => t.onChange(v => code = v.trim()))
      .addButton(btn => btn
        .setButtonText("Verify")
        .onClick(async () => {
          const data = await sendAuthReq(config.clientId, config.authority, code, verifier);
          // @ts-ignore
          await setConfigBySuccessfullAuthInplace(config, data, () => this.plugin.saveSettings());
          modal.close();
          onDone();
        })
      );
    modal.open();
  }
}
