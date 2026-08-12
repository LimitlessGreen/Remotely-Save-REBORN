import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import type RemotelySavePlugin from "../../main";
import { InternxtClient } from "./InternxtClient";

export const DEFAULT_INTERNXT_CONFIG = {
  email: "",
  token: "",
  mnemonic: "",
  remoteBaseDir: "",
  kind: "internxt" as const,
};

export class InternxtSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const { t } = this;
    const root = containerEl.createDiv({ cls: "internxt-settings-section" });
    root.toggleClass("internxt-hide", this.plugin.settings.serviceType !== "internxt");

    this.addHeader(root, t("settings_internxt"));

    this.addDirectorySetting(root);
    this.addAuthSection(root);
  }

  private addDirectorySetting(el: HTMLElement) {
    const { t } = this;
    let dir = this.plugin.settings.internxt?.remoteBaseDir || "";
    new Setting(el)
      .setName(t("settings_internxt_folder"))
      .addText(text => text
        .setValue(dir)
        .onChange(v => dir = v.trim())
      )
      .addButton(btn => btn
        .setButtonText(t("confirm"))
        .onClick(async () => {
          if (!this.plugin.settings.internxt) {
            this.plugin.settings.internxt = { ...DEFAULT_INTERNXT_CONFIG };
          }
          this.plugin.settings.internxt.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice(t("settings_internxt_folder_notice"));
        })
      );
  }

  private addAuthSection(el: HTMLElement) {
    const { t } = this;
    const area = el.createDiv();
    const refresh = () => {
      area.empty();
      const linked = !!this.plugin.settings.internxt?.token;
      new Setting(area)
        .setName(linked ? t("settings_internxt_revoke") : t("settings_internxt_connect"))
        .addButton(btn => btn
          .setButtonText(linked ? t("settings_internxt_revoke_button") : t("settings_internxt_connect_button"))
          .onClick(async () => {
            if (linked) {
              this.plugin.settings.internxt = { ...DEFAULT_INTERNXT_CONFIG };
              await this.plugin.saveSettings();
              refresh();
            } else {
              new InternxtLoginModal(this.app, this.plugin, t, () => refresh()).open();
            }
          })
        );
    };
    refresh();
  }
}

class InternxtLoginModal extends Modal {
  private email = "";
  private password = "";

  constructor(app: App, private plugin: RemotelySavePlugin, private t: any, private callback: () => void) {
    super(app);
  }

  onOpen() {
    const { contentEl, t } = this;
    contentEl.createEl("h2", { text: t("settings_internxt_login_title") });

    new Setting(contentEl)
      .setName(t("settings_internxt_email"))
      .addText(text => text.onChange(v => this.email = v));

    new Setting(contentEl)
      .setName(t("settings_internxt_password"))
      .addText(text => {
        text.inputEl.type = "password";
        text.onChange(v => this.password = v);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t("settings_internxt_login_button"))
        .setCta()
        .onClick(async () => {
          try {
            const client = new InternxtClient(undefined, {
              clientName: this.plugin.manifest.id,
              clientVersion: this.plugin.manifest.version
            });
            const loginRes = await client.login(this.email, this.password);

            this.plugin.settings.internxt = {
              email: this.email,
              token: loginRes.token,
              mnemonic: loginRes.mnemonic,
              rootFolderUuid: loginRes.user.rootFolderId,
              bucketId: loginRes.user.bucket,
              bridgeUser: loginRes.user.bridgeUser,
              userId: loginRes.user.userId,
              kind: "internxt",
            };

            await this.plugin.saveSettings();
            new Notice(t("settings_internxt_connect_succ"));
            this.callback();
            this.close();
          } catch (e: any) {
            console.error(e);
            new Notice(`${t("settings_internxt_login_button")} failed: ${e.message}`);
          }
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
