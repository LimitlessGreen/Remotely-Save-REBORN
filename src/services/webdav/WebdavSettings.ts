import { Notice, Setting } from "obsidian";
import type { WebdavAuthType } from "../../core/baseTypes";
import { VALID_REQURL } from "../../core/baseTypesObs";
import { getClient } from "../../core/fs/fsGetter";
import { ChangeRemoteBaseDirModal } from "../../settings";
import { wrapTextWithPasswordHide } from "../../ui/managers/BasicSettings";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { stringToFragment } from "../../utils/misc";

export class WebdavSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "webdav-settings-section" });
    root.toggleClass(
      "webdav-hide",
      this.plugin.settings.serviceType !== "webdav"
    );

    this.addHeader(root, this.t("settings_webdav"));

    const webdavLongDescDiv = root.createDiv({
      cls: "settings-long-desc",
    });

    webdavLongDescDiv.createEl("p", {
      text: this.t("settings_webdav_disclaimer1"),
      cls: "webdav-disclaimer",
    });

    if (!VALID_REQURL) {
      webdavLongDescDiv.createEl("p", {
        text: this.t("settings_webdav_cors_os"),
      });

      webdavLongDescDiv.createEl("p", {
        text: this.t("settings_webdav_cors"),
      });
    }

    webdavLongDescDiv.createEl("p", {
      text: this.t("settings_webdav_folder", {
        remoteBaseDir:
          this.plugin.settings.webdav.remoteBaseDir || this.app.vault.getName(),
      }),
    });

    new Setting(root)
      .setName(this.t("settings_webdav_addr"))
      .setDesc(this.t("settings_webdav_addr_desc"))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.webdav.address)
          .onChange(async (value) => {
            this.plugin.settings.webdav.address = value.trim();
            // deprecate auto on 20240116, force to manual_1
            if (
              this.plugin.settings.webdav.depth === "auto" ||
              this.plugin.settings.webdav.depth === "auto_1" ||
              this.plugin.settings.webdav.depth === "auto_infinity" ||
              this.plugin.settings.webdav.depth === "auto_unknown"
            ) {
              this.plugin.settings.webdav.depth = "manual_1";
            }

            // normally saved
            await this.plugin.saveSettings();
          })
      );

    new Setting(root)
      .setName(this.t("settings_webdav_user"))
      .setDesc(this.t("settings_webdav_user_desc"))
      .addText((text) => {
        wrapTextWithPasswordHide(text);
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.webdav.username)
          .onChange(async (value) => {
            this.plugin.settings.webdav.username = value.trim();
            // deprecate auto on 20240116, force to manual_1
            if (
              this.plugin.settings.webdav.depth === "auto" ||
              this.plugin.settings.webdav.depth === "auto_1" ||
              this.plugin.settings.webdav.depth === "auto_infinity" ||
              this.plugin.settings.webdav.depth === "auto_unknown"
            ) {
              this.plugin.settings.webdav.depth = "manual_1";
            }
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_webdav_password"))
      .setDesc(this.t("settings_webdav_password_desc"))
      .addText((text) => {
        wrapTextWithPasswordHide(text);
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.webdav.password)
          .onChange(async (value) => {
            this.plugin.settings.webdav.password = value.trim();
            // deprecate auto on 20240116, force to manual_1
            if (
              this.plugin.settings.webdav.depth === "auto" ||
              this.plugin.settings.webdav.depth === "auto_1" ||
              this.plugin.settings.webdav.depth === "auto_infinity" ||
              this.plugin.settings.webdav.depth === "auto_unknown"
            ) {
              this.plugin.settings.webdav.depth = "manual_1";
            }
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_webdav_auth"))
      .setDesc(this.t("settings_webdav_auth_desc"))
      .addDropdown(async (dropdown) => {
        dropdown.addOption("basic", "basic");
        if (VALID_REQURL) {
          dropdown.addOption("digest", "digest");
        }

        // new version config, copied to old version, we need to reset it
        if (!VALID_REQURL && this.plugin.settings.webdav.authType !== "basic") {
          this.plugin.settings.webdav.authType = "basic";
          await this.plugin.saveSettings();
        }

        dropdown
          .setValue(this.plugin.settings.webdav.authType)
          .onChange(async (val) => {
            this.plugin.settings.webdav.authType = val as WebdavAuthType;
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_webdav_depth"))
      .setDesc(this.t("settings_webdav_depth_desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("manual_1", this.t("settings_webdav_depth_1"));
        dropdown.addOption(
          "manual_infinity",
          this.t("settings_webdav_depth_inf")
        );

        dropdown
          .setValue(this.plugin.settings.webdav.depth || "manual_1")
          .onChange(async (val) => {
            if (val === "manual_1") {
              this.plugin.settings.webdav.depth = "manual_1";
              this.plugin.settings.webdav.manualRecursive = true;
            } else if (val === "manual_infinity") {
              this.plugin.settings.webdav.depth = "manual_infinity";
              this.plugin.settings.webdav.manualRecursive = false;
            }

            // normally save
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_webdav_customheaders"))
      .setDesc(stringToFragment(this.t("settings_webdav_customheaders_desc")))
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder(`X-Header1: Value1\nX-Header2: Value2`)
          .setValue(`${this.plugin.settings.webdav.customHeaders ?? ""}`)
          .onChange(async (value) => {
            this.plugin.settings.webdav.customHeaders = value
              .trim()
              .split("\n")
              .filter((x) => x.trim() !== "")
              .join("\n");
            await this.plugin.saveSettings();
          });
        textArea.inputEl.rows = 10;
        textArea.inputEl.cols = 30;

        textArea.inputEl.addClass("webdav-customheaders-textarea");
      });

    let newWebdavRemoteBaseDir =
      this.plugin.settings.webdav.remoteBaseDir || "";
    new Setting(root)
      .setName(this.t("settings_remotebasedir"))
      .setDesc(this.t("settings_remotebasedir_desc"))
      .addText((text) =>
        text
          .setPlaceholder(this.app.vault.getName())
          .setValue(newWebdavRemoteBaseDir)
          .onChange((value) => {
            newWebdavRemoteBaseDir = value.trim();
          })
      )
      .addButton((button) => {
        button.setButtonText(this.t("confirm"));
        button.onClick(() => {
          new ChangeRemoteBaseDirModal(
            this.app,
            this.plugin,
            newWebdavRemoteBaseDir,
            "webdav"
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
            new Notice(this.t("settings_webdav_connect_succ"));
          } else {
            if (VALID_REQURL) {
              new Notice(this.t("settings_webdav_connect_fail"));
            } else {
              new Notice(this.t("settings_webdav_connect_fail_withcors"));
            }
            new Notice(errors.msg);
          }
        });
      });
  }
}
