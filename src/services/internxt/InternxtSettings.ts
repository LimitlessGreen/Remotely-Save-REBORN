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
    const root = containerEl.createDiv({ cls: "internxt-settings-section" });
    root.toggleClass("internxt-hide", this.plugin.settings.serviceType !== "internxt");

    this.addHeader(root, "Internxt Settings");

    this.addDirectorySetting(root);
    this.addAuthSection(root);
  }

  private addDirectorySetting(el: HTMLElement) {
    let dir = this.plugin.settings.internxt?.remoteBaseDir || "";
    new Setting(el)
      .setName("Remote Base Directory")
      .addText(text => text
        .setValue(dir)
        .onChange(v => dir = v.trim())
      )
      .addButton(btn => btn
        .setButtonText("Confirm")
        .onClick(async () => {
          if (!this.plugin.settings.internxt) {
            this.plugin.settings.internxt = { ...DEFAULT_INTERNXT_CONFIG };
          }
          this.plugin.settings.internxt.remoteBaseDir = dir;
          await this.plugin.saveSettings();
          new Notice("Remote base directory updated");
        })
      );
  }

  private addAuthSection(el: HTMLElement) {
    const area = el.createDiv();
    const refresh = () => {
      area.empty();
      const linked = !!this.plugin.settings.internxt?.token;
      new Setting(area)
        .setName(linked ? "Revoke Internxt" : "Connect to Internxt")
        .addButton(btn => btn
          .setButtonText(linked ? "Revoke" : "Connect")
          .onClick(async () => {
            if (linked) {
              this.plugin.settings.internxt = { ...DEFAULT_INTERNXT_CONFIG };
              await this.plugin.saveSettings();
              refresh();
            } else {
              new InternxtLoginModal(this.app, this.plugin, () => refresh()).open();
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

  constructor(app: App, private plugin: RemotelySavePlugin, private callback: () => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Login to Internxt" });

    new Setting(contentEl)
      .setName("Email")
      .addText(text => text.onChange(v => this.email = v));

    new Setting(contentEl)
      .setName("Password")
      .addText(text => {
        text.inputEl.type = "password";
        text.onChange(v => this.password = v);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Login")
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
            new Notice("Connected to Internxt!");
            this.callback();
            this.close();
          } catch (e: any) {
            console.error(e);
            new Notice(`Login failed: ${e.message}`);
          }
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}
