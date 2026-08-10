import { type App, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { getClient } from "../../core/fs/fsGetter";
import { ChangeRemoteBaseDirModal } from "../../settings";
import { wrapTextWithPasswordHide } from "../../ui/managers/BasicSettings";

export class WebdisSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "webdis-settings-section" });
    root.toggleClass(
      "webdis-hide",
      this.plugin.settings.serviceType !== "webdis"
    );

    this.addHeader(root, this.t("settings_webdis"));

    const webdisLongDescDiv = root.createDiv({
      cls: "settings-long-desc",
    });

    for (const c of [
      this.t("settings_webdis_disclaimer1"),
      this.t("settings_webdis_disclaimer2"),
    ]) {
      webdisLongDescDiv.createEl("p", {
        text: c,
        cls: "webdis-disclaimer",
      });
    }

    webdisLongDescDiv.createEl("p", {
      text: this.t("settings_webdis_folder", {
        remoteBaseDir:
          this.plugin.settings.webdis.remoteBaseDir || this.app.vault.getName(),
      }),
    });

    new Setting(root)
      .setName(this.t("settings_webdis_addr"))
      .setDesc(this.t("settings_webdis_addr_desc"))
      .addText((text) =>
        text
          .setPlaceholder("https://")
          .setValue(this.plugin.settings.webdis.address)
          .onChange(async (value) => {
            this.plugin.settings.webdis.address = value.trim();
            // normally saved
            await this.plugin.saveSettings();
          })
      );

    new Setting(root)
      .setName(this.t("settings_webdis_user"))
      .setDesc(this.t("settings_webdis_user_desc"))
      .addText((text) => {
        wrapTextWithPasswordHide(text);
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.webdis.username ?? "")
          .onChange(async (value) => {
            this.plugin.settings.webdis.username = (value ?? "").trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_webdis_password"))
      .setDesc(this.t("settings_webdis_password_desc"))
      .addText((text) => {
        wrapTextWithPasswordHide(text);
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.webdis.password ?? "")
          .onChange(async (value) => {
            this.plugin.settings.webdis.password = (value ?? "").trim();
            await this.plugin.saveSettings();
          });
      });

    let newWebdisRemoteBaseDir =
      this.plugin.settings.webdis.remoteBaseDir || "";
    new Setting(root)
      .setName(this.t("settings_remotebasedir"))
      .setDesc(this.t("settings_remotebasedir_desc"))
      .addText((text) =>
        text
          .setPlaceholder(this.app.vault.getName())
          .setValue(newWebdisRemoteBaseDir)
          .onChange((value) => {
            newWebdisRemoteBaseDir = value.trim();
          })
      )
      .addButton((button) => {
        button.setButtonText(this.t("confirm"));
        button.onClick(() => {
          new ChangeRemoteBaseDirModal(
            this.app,
            this.plugin,
            newWebdisRemoteBaseDir,
            "webdis"
          ).open();
        });
      });

    new Setting(root)
      .setName(this.t("settings_checkonnectivity"))
      .setDesc(this.t("settings_checkonnectivity_desc"))
      .addButton(async (button) => {
        button.setButtonText(this.t("settings_checkonnectivity_button"));
        button.onClick(async () => {
          new Notice(this.t("settings_checkonnectivity_checking"));
          const client = getClient(
            this.plugin.settings,
            this.app.vault.getName(),
            () => this.plugin.saveSettings()
          );
          const errors = { msg: "" };
          const res = await client.checkConnect((err: any) => {
            errors.msg = `${err}`;
          });
          if (res) {
            new Notice(this.t("settings_webdis_connect_succ"));
          } else {
            new Notice(this.t("settings_webdis_connect_fail"));
            new Notice(errors.msg);
          }
        });
      });
  }
}
