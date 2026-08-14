import { createElement, Eye, EyeOff } from "lucide";
import {
  type App,
  Modal,
  Notice,
  Platform,
  Setting,
  type TextComponent,
} from "obsidian";
import type { CipherMethodType } from "../../core/baseTypes";
import type { TransItemType } from "../../core/i18n/i18n";
import {
  upsertLastFailedSyncTimeByVault,
  upsertLastSuccessSyncTimeByVault,
} from "../../core/storage/localdb";
import type RemotelySavePlugin from "../../main";
import { stringToFragment } from "../../utils/misc";
import { BaseSettingsManager } from "../settingsManager";

class PasswordModal extends Modal {
  plugin: RemotelySavePlugin;
  newPassword: string;
  encryptionMethodSetting: Setting;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    newPassword: string,
    encryptionMethodSetting: Setting
  ) {
    super(app);
    this.plugin = plugin;
    this.newPassword = newPassword;
    this.encryptionMethodSetting = encryptionMethodSetting;
  }

  onOpen() {
    const { contentEl } = this;

    const t = (x: TransItemType, vars?: any) => {
      return this.plugin.i18n.t(x, vars);
    };

    contentEl.createEl("h2", { text: t("modal_password_title") });
    t("modal_password_shortdesc")
      .split("\n")
      .forEach((val, _idx) => {
        contentEl.createEl("p", {
          text: val,
        });
      });

    [
      t("modal_password_attn1"),
      t("modal_password_attn2"),
      t("modal_password_attn3"),
      t("modal_password_attn4"),
      t("modal_password_attn5"),
    ].forEach((val, idx) => {
      if (idx < 3) {
        contentEl.createEl("p", {
          text: val,
          cls: "password-disclaimer",
        });
      } else {
        contentEl.createEl("p", {
          text: val,
        });
      }
    });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText(t("modal_password_secondconfirm"));
        button.onClick(async () => {
          this.plugin.settings.password = this.newPassword;
          if (this.newPassword !== "") {
            this.encryptionMethodSetting.settingEl.removeClass(
              "settings-encryption-method-hide"
            );
          } else {
            this.encryptionMethodSetting.settingEl.addClass(
              "settings-encryption-method-hide"
            );
          }

          await this.plugin.saveSettings();
          new Notice(t("modal_password_notice"));
          this.close();
        });
        button.setClass("password-second-confirm");
      })
      .addButton((button) => {
        button.setButtonText(t("goback"));
        button.onClick(() => {
          this.close();
        });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class EncryptionMethodModal extends Modal {
  plugin: RemotelySavePlugin;
  constructor(app: App, plugin: RemotelySavePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;

    const t = (x: TransItemType, vars?: any) => {
      return this.plugin.i18n.t(x, vars);
    };

    contentEl.createEl("h2", { text: t("modal_encryptionmethod_title") });
    t("modal_encryptionmethod_shortdesc")
      .split("\n")
      .forEach((val, _idx) => {
        contentEl.createEl("p", {
          text: stringToFragment(val),
        });
      });

    new Setting(contentEl).addButton((button) => {
      button.setButtonText(t("confirm"));
      button.onClick(async () => {
        this.close();
      });
      button.setClass("encryptionmethod-second-confirm");
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

const getEyesElements = () => {
  const eyeEl = createElement(Eye);
  const eyeOffEl = createElement(EyeOff);
  return {
    eye: eyeEl.outerHTML,
    eyeOff: eyeOffEl.outerHTML,
  };
};

export const wrapTextWithPasswordHide = (text: TextComponent) => {
  const { eye, eyeOff } = getEyesElements();
  const hider = text.inputEl.insertAdjacentElement("afterend", createSpan())!;
  hider.innerHTML = eyeOff;
  hider.addEventListener("click", (_e) => {
    const isText = text.inputEl.getAttribute("type") === "text";
    hider.innerHTML = isText ? eyeOff : eye;
    text.inputEl.setAttribute("type", isText ? "password" : "text");
    text.inputEl.focus();
  });

  text.inputEl.setAttribute("type", "password");
  return text;
};

export class BasicSettingsManager extends BaseSettingsManager {
  render(containerEl: HTMLElement): void {
    const { t, plugin, app } = this;

    const basicDiv = containerEl.createEl("div");
    this.addHeader(basicDiv, t("settings_basic"));

    const passwordSetting = new Setting(basicDiv);
    const encryptionMethodSetting = new Setting(basicDiv);

    let newPassword = `${plugin.settings.password}`;
    passwordSetting
      .setName(t("settings_password"))
      .setDesc(t("settings_password_desc"))
      .addText((text) => {
        wrapTextWithPasswordHide(text);
        text
          .setPlaceholder("")
          .setValue(`${plugin.settings.password}`)
          .onChange(async (value) => {
            newPassword = value.trim();
          });
      })
      .addButton(async (button) => {
        button.setButtonText(t("confirm"));
        button.onClick(async () => {
          new PasswordModal(
            app,
            plugin,
            newPassword,
            encryptionMethodSetting
          ).open();
        });
      });

    if (plugin.settings.password === "") {
      encryptionMethodSetting.settingEl.addClass(
        "settings-encryption-method-hide"
      );
    }
    encryptionMethodSetting
      .setName(t("settings_encryptionmethod"))
      .setDesc(stringToFragment(t("settings_encryptionmethod_desc")))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("rclone-base64", t("settings_encryptionmethod_rclone"))
          .addOption("openssl-base64", t("settings_encryptionmethod_openssl"))
          .setValue(plugin.settings.encryptionMethod ?? "rclone-base64")
          .onChange(async (val: string) => {
            plugin.settings.encryptionMethod = val as CipherMethodType;
            await plugin.saveSettings();
            if (plugin.settings.password !== "") {
              new EncryptionMethodModal(app, plugin).open();
            }
          });
      });

    new Setting(basicDiv)
      .setName(t("settings_autorun"))
      .setDesc(t("settings_autorun_desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("-1", t("settings_autorun_notset"));
        dropdown.addOption(`${1000 * 60 * 1}`, t("settings_autorun_1min"));
        dropdown.addOption(`${1000 * 60 * 5}`, t("settings_autorun_5min"));
        dropdown.addOption(`${1000 * 60 * 10}`, t("settings_autorun_10min"));
        dropdown.addOption(`${1000 * 60 * 30}`, t("settings_autorun_30min"));

        dropdown
          .setValue(`${plugin.settings.autoRunEveryMilliseconds}`)
          .onChange(async (val: string) => {
            const realVal = Number.parseInt(val, 10);
            plugin.settings.autoRunEveryMilliseconds = realVal;
            await plugin.saveSettings();
            if (
              (realVal === undefined || realVal === null || realVal <= 0) &&
              plugin.autoRunIntervalID !== undefined
            ) {
              window.clearInterval(plugin.autoRunIntervalID);
              plugin.autoRunIntervalID = undefined;
            } else if (
              realVal !== undefined &&
              realVal !== null &&
              realVal > 0
            ) {
              const intervalID = window.setInterval(() => {
                console.info("auto run from settings.ts");
                plugin.syncRun("auto");
              }, realVal);
              plugin.autoRunIntervalID = intervalID;
              plugin.registerInterval(intervalID);
            }
          });
      });

    new Setting(basicDiv)
      .setName(t("settings_runoncestartup"))
      .setDesc(t("settings_runoncestartup_desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("-1", t("settings_runoncestartup_notset"));
        dropdown.addOption(
          `${1000 * 1 * 1}`,
          t("settings_runoncestartup_1sec")
        );
        dropdown.addOption(
          `${1000 * 10 * 1}`,
          t("settings_runoncestartup_10sec")
        );
        dropdown.addOption(
          `${1000 * 30 * 1}`,
          t("settings_runoncestartup_30sec")
        );
        dropdown
          .setValue(`${plugin.settings.initRunAfterMilliseconds}`)
          .onChange(async (val: string) => {
            const realVal = Number.parseInt(val, 10);
            plugin.settings.initRunAfterMilliseconds = realVal;
            await plugin.saveSettings();
          });
      });

    new Setting(basicDiv)
      .setName(t("settings_synconsave"))
      .setDesc(t("settings_synconsave_desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("-1", t("settings_synconsave_disable"));
        dropdown.addOption("1000", t("settings_synconsave_enable"));
        let syncOnSaveEnabled = false;
        if ((plugin.settings.syncOnSaveAfterMilliseconds ?? -1) > 0) {
          syncOnSaveEnabled = true;
        }
        dropdown
          .setValue(`${syncOnSaveEnabled ? "1000" : "-1"}`)
          .onChange(async (val: string) => {
            plugin.settings.syncOnSaveAfterMilliseconds = Number.parseInt(
              val,
              10
            );
            await plugin.saveSettings();
            plugin.toggleSyncOnSaveIfSet();
          });
      });

    new Setting(basicDiv)
      .setName(t("settings_skiplargefiles"))
      .setDesc(t("settings_skiplargefiles_desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("-1", t("settings_skiplargefiles_notset"));

        const mbs = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
        for (const mb of mbs) {
          dropdown.addOption(`${mb * 1000 * 1000}`, `${mb} MB`);
        }
        dropdown
          .setValue(`${plugin.settings.skipSizeLargerThan}`)
          .onChange(async (val) => {
            plugin.settings.skipSizeLargerThan = Number.parseInt(val, 10);
            await plugin.saveSettings();
          });
      });

    if (!Platform.isMobileApp) {
      new Setting(basicDiv)
        .setName(t("settings_enablestatusbar_info"))
        .setDesc(t("settings_enablestatusbar_info_desc"))
        .addToggle((toggle) => {
          toggle
            .setValue(plugin.settings.enableStatusBarInfo ?? false)
            .onChange(async (val) => {
              plugin.settings.enableStatusBarInfo = val;
              await plugin.saveSettings();
              new Notice(t("settings_enablestatusbar_reloadrequired_notice"));
            });
        });

      new Setting(basicDiv)
        .setName(t("settings_resetstatusbar_time"))
        .setDesc(t("settings_resetstatusbar_time_desc"))
        .addButton((button) => {
          button.setButtonText(t("settings_resetstatusbar_button"));
          button.onClick(async () => {
            await upsertLastSuccessSyncTimeByVault(
              plugin.db,
              plugin.vaultRandomID,
              -1
            );
            await upsertLastFailedSyncTimeByVault(
              plugin.db,
              plugin.vaultRandomID,
              -1
            );
            plugin.updateLastSyncMsg(undefined, "not_syncing", null, null);
            new Notice(t("settings_resetstatusbar_notice"));
          });
        });
    }

    new Setting(basicDiv)
      .setName(t("settings_ignorepaths"))
      .setDesc(t("settings_ignorepaths_desc"))
      .setClass("ignorepaths-settings")
      .addTextArea((textArea) => {
        textArea
          .setValue(`${(plugin.settings.ignorePaths ?? []).join("\n")}`)
          .onChange(async (value) => {
            plugin.settings.ignorePaths = value
              .trim()
              .split("\n")
              .filter((x) => x.trim() !== "");
            await plugin.saveSettings();
          });
        textArea.inputEl.rows = 10;
        textArea.inputEl.cols = 30;
        textArea.inputEl.addClass("ignorepaths-textarea");
      });

    new Setting(basicDiv)
      .setName(t("settings_onlyallowpaths"))
      .setDesc(t("settings_onlyallowpaths_desc"))
      .setClass("onlyallowpaths-settings")
      .addTextArea((textArea) => {
        textArea
          .setValue(`${(plugin.settings.onlyAllowPaths ?? []).join("\n")}`)
          .onChange(async (value) => {
            plugin.settings.onlyAllowPaths = value
              .trim()
              .split("\n")
              .filter((x) => x.trim() !== "");
            await plugin.saveSettings();
          });
        textArea.inputEl.rows = 10;
        textArea.inputEl.cols = 30;
        textArea.inputEl.addClass("onlyallowpaths-textarea");
      });
  }
}
