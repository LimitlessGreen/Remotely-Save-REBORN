import { type App, Modal, Notice, Platform, Setting } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { BaseSettingsManager } from "../../ui/settingsManager";
import {
  DEFAULT_ONEDRIVE_CONFIG,
  DEFAULT_ONEDRIVEFULL_CONFIG,
  getAuthUrlAndVerifier as getAuthUrlAndVerifierOnedrive,
  OneDriveFileSystem,
} from "./OneDriveFileSystem";
import {
  type OnedriveConfig,
  type OnedriveFullConfig,
} from "../../core/baseTypes";
import { getClient } from "../../core/fs/fsGetter";
import { ChangeRemoteBaseDirModal } from "../../settings";
import type { TransItemType } from "../../core/i18n/i18n";
import { stringToFragment } from "../../utils/misc";

export class OnedriveAuthModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly authDiv: HTMLDivElement;
  readonly revokeAuthDiv: HTMLDivElement;
  readonly revokeAuthSetting: Setting;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    authDiv: HTMLDivElement,
    revokeAuthDiv: HTMLDivElement,
    revokeAuthSetting: Setting
  ) {
    super(app);
    this.plugin = plugin;
    this.authDiv = authDiv;
    this.revokeAuthDiv = revokeAuthDiv;
    this.revokeAuthSetting = revokeAuthSetting;
  }

  async onOpen() {
    const { contentEl } = this;
    const isFull = this.plugin.settings.serviceType === "onedrivefull";
    const config = isFull
      ? this.plugin.settings.onedrivefull
      : this.plugin.settings.onedrive;

    const { authUrl, verifier } = await getAuthUrlAndVerifierOnedrive(
      config.clientID,
      config.authority
    );
    this.plugin.oauth2Info.verifier = verifier;

    const t = (x: TransItemType, vars?: any) => {
      return this.plugin.i18n.t(x, vars);
    };

    t("modal_onedriveauth_shortdesc")
      .split("\n")
      .forEach((val) => {
        contentEl.createEl("p", {
          text: val,
        });
      });
    if (Platform.isLinux) {
      t("modal_onedriveauth_shortdesc_linux")
        .split("\n")
        .forEach((val) => {
          contentEl.createEl("p", {
            text: stringToFragment(val),
          });
        });
    }
    const div2 = contentEl.createDiv();
    div2.createEl(
      "button",
      {
        text: t("modal_onedriveauth_copybutton"),
      },
      (el) => {
        el.onclick = async () => {
          await navigator.clipboard.writeText(authUrl);
          new Notice(t("modal_onedriveauth_copynotice"));
        };
      }
    );

    contentEl.createEl("p").createEl("a", {
      href: authUrl,
      text: authUrl,
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class OnedriveRevokeAuthModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly authDiv: HTMLDivElement;
  readonly revokeAuthDiv: HTMLDivElement;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    authDiv: HTMLDivElement,
    revokeAuthDiv: HTMLDivElement
  ) {
    super(app);
    this.plugin = plugin;
    this.authDiv = authDiv;
    this.revokeAuthDiv = revokeAuthDiv;
  }

  async onOpen() {
    const { contentEl } = this;
    const isFull = this.plugin.settings.serviceType === "onedrivefull";
    const t = (x: TransItemType, vars?: any) => {
      return this.plugin.i18n.t(x, vars);
    };

    contentEl.createEl("p", {
      text: t("modal_onedriverevokeauth_step1"),
    });
    const consentUrl = "https://microsoft.com/consent";
    contentEl.createEl("p").createEl("a", {
      href: consentUrl,
      text: consentUrl,
    });

    contentEl.createEl("p", {
      text: t("modal_onedriverevokeauth_step2"),
    });

    new Setting(contentEl)
      .setName(t("modal_onedriverevokeauth_clean"))
      .setDesc(t("modal_onedriverevokeauth_clean_desc"))
      .addButton(async (button) => {
        button.setButtonText(t("modal_onedriverevokeauth_clean_button"));
        button.onClick(async () => {
          try {
            if (isFull) {
              this.plugin.settings.onedrivefull = JSON.parse(
                JSON.stringify(DEFAULT_ONEDRIVEFULL_CONFIG)
              );
            } else {
              this.plugin.settings.onedrive = JSON.parse(
                JSON.stringify(DEFAULT_ONEDRIVE_CONFIG)
              );
            }
            await this.plugin.saveSettings();

            const config = isFull
              ? this.plugin.settings.onedrivefull
              : this.plugin.settings.onedrive;
            const prefix = isFull ? "onedrivefull" : "onedrive";

            this.authDiv.toggleClass(
              `${prefix}-auth-button-hide`,
              config.username !== ""
            );
            this.revokeAuthDiv.toggleClass(
              `${prefix}-revoke-auth-button-hide`,
              config.username === ""
            );
            new Notice(t("modal_onedriverevokeauth_clean_notice"));
            this.close();
          } catch (err) {
            console.error(err);
            new Notice(t("modal_onedriverevokeauth_clean_fail"));
          }
        });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class OneDriveSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const isFull = this.plugin.settings.serviceType === "onedrivefull";
    const prefix = isFull ? "onedrivefull" : "onedrive";
    const root = containerEl.createDiv({ cls: `${prefix}-settings-section` });
    root.toggleClass(
      `${prefix}-hide`,
      this.plugin.settings.serviceType !== (isFull ? "onedrivefull" : "onedrive")
    );

    this.addHeader(
      root,
      isFull ? this.t("settings_onedrivefull") : this.t("settings_onedrive")
    );
    const onedriveLongDescDiv = root.createEl("div", {
      cls: "settings-long-desc",
    });

    const disclaimers = isFull
      ? [
          this.t("settings_onedrivefull_disclaimer1"),
          this.t("settings_onedrivefull_disclaimer2"),
        ]
      : [
          this.t("settings_onedrive_disclaimer1"),
          this.t("settings_onedrive_disclaimer2"),
        ];

    for (const c of disclaimers) {
      onedriveLongDescDiv.createEl("p", {
        text: c,
        cls: `${prefix}-disclaimer`,
      });
    }

    const config = isFull
      ? this.plugin.settings.onedrivefull
      : this.plugin.settings.onedrive;

    onedriveLongDescDiv.createEl("p", {
      text: this.t(isFull ? "settings_onedrivefull_folder" : "settings_onedrive_folder", {
        pluginID: this.plugin.manifest.id,
        remoteBaseDir: config.remoteBaseDir || this.app.vault.getName(),
      }),
    });

    if (!isFull) {
      onedriveLongDescDiv.createEl("p", {
        text: this.t("settings_onedrive_nobiz"),
      });
    }

    const onedriveSelectAuthDiv = root.createDiv();
    const onedriveAuthDiv = onedriveSelectAuthDiv.createDiv({
      cls: `${prefix}-auth-button-hide settings-auth-related`,
    });
    const onedriveRevokeAuthDiv = onedriveSelectAuthDiv.createDiv({
      cls: `${prefix}-revoke-auth-button-hide settings-auth-related`,
    });

    const onedriveRevokeAuthSetting = new Setting(onedriveRevokeAuthDiv)
      .setName(this.t(isFull ? "settings_onedrivefull_revoke" : "settings_onedrive_revoke"))
      .setDesc(
        this.t(isFull ? "settings_onedrivefull_revoke_desc" : "settings_onedrive_revoke_desc", {
          username: config.username,
        })
      )
      .addButton(async (button) => {
        button.setButtonText(this.t(isFull ? "settings_onedrivefull_revoke_button" : "settings_onedrive_revoke_button"));
        button.onClick(async () => {
          new OnedriveRevokeAuthModal(
            this.app,
            this.plugin,
            onedriveAuthDiv,
            onedriveRevokeAuthDiv
          ).open();
        });
      });

    new Setting(onedriveAuthDiv)
      .setName(this.t(isFull ? "settings_onedrivefull_auth" : "settings_onedrive_auth"))
      .setDesc(this.t(isFull ? "settings_onedrivefull_auth_desc" : "settings_onedrive_auth_desc"))
      .addButton(async (button) => {
        button.setButtonText(this.t(isFull ? "settings_onedrivefull_auth_button" : "settings_onedrive_auth_button"));
        button.onClick(async () => {
          const modal = new OnedriveAuthModal(
            this.app,
            this.plugin,
            onedriveAuthDiv,
            onedriveRevokeAuthDiv,
            onedriveRevokeAuthSetting
          );
          this.plugin.oauth2Info.helperModal = modal;
          this.plugin.oauth2Info.authDiv = onedriveAuthDiv;
          this.plugin.oauth2Info.revokeDiv = onedriveRevokeAuthDiv;
          this.plugin.oauth2Info.revokeAuthSetting = onedriveRevokeAuthSetting;
          modal.open();
        });
      });

    onedriveAuthDiv.toggleClass(
      `${prefix}-auth-button-hide`,
      config.username !== ""
    );
    onedriveRevokeAuthDiv.toggleClass(
      `${prefix}-revoke-auth-button-hide`,
      config.username === ""
    );

    let newOnedriveRemoteBaseDir = config.remoteBaseDir || "";
    new Setting(root)
      .setName(this.t("settings_remotebasedir"))
      .setDesc(this.t("settings_remotebasedir_desc"))
      .addText((text) =>
        text
          .setPlaceholder(this.app.vault.getName())
          .setValue(newOnedriveRemoteBaseDir)
          .onChange((value) => {
            newOnedriveRemoteBaseDir = value.trim();
          })
      )
      .addButton((button) => {
        button.setButtonText(this.t("confirm"));
        button.onClick(() => {
          new ChangeRemoteBaseDirModal(
            this.app,
            this.plugin,
            newOnedriveRemoteBaseDir,
            prefix as any
          ).open();
        });
      });

    new Setting(root)
      .setName(this.t(isFull ? "settings_onedrivefull_emptyfile" : "settings_onedrive_emptyfile"))
      .setDesc(this.t(isFull ? "settings_onedrivefull_emptyfile_desc" : "settings_onedrive_emptyfile_desc"))
      .addDropdown(async (dropdown) => {
        dropdown
          .addOption("skip", this.t(isFull ? "settings_onedrivefull_emptyfile_skip" : "settings_onedrive_emptyfile_skip"))
          .addOption("error", this.t(isFull ? "settings_onedrivefull_emptyfile_error" : "settings_onedrive_emptyfile_error"))
          .setValue(config.emptyFile)
          .onChange(async (val) => {
            config.emptyFile = val as any;
            await this.plugin.saveSettings();
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
            new Notice(this.t(isFull ? "settings_onedrivefull_connect_succ" : "settings_onedrive_connect_succ"));
          } else {
            new Notice(this.t(isFull ? "settings_onedrivefull_connect_fail" : "settings_onedrive_connect_fail"));
            new Notice(errors.msg);
          }
        });
      });
  }
}
