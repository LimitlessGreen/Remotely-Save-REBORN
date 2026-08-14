import { type App, Modal, Notice, Platform, Setting } from "obsidian";
import { getClient } from "../../core/fs/fsGetter";
import type { TFunc, TransItemType } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import { ChangeRemoteBaseDirModal } from "../../settings";
import { BaseSettingsManager } from "../../ui/settingsManager";
import {
  DEFAULT_DROPBOX_CONFIG,
  getAuthUrlAndVerifier as getAuthUrlAndVerifierDropbox,
  sendAuthReq as sendAuthReqDropbox,
  setConfigBySuccessfullAuthInplace,
} from "./DropboxFileSystem";

class DropboxAuthModal extends Modal {
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

    const t: TFunc = (x, vars) => {
      return this.plugin.i18n.t(x, vars);
    };

    let needManualPatse = false;
    const userAgent = window.navigator.userAgent.toLocaleLowerCase() || "";
    // some users report that,
    // the Linux would open another instance Obsidian if jumping back,
    // so fallback to manual paste on Linux
    if (
      Platform.isDesktopApp &&
      !Platform.isMacOS &&
      (/linux/.test(userAgent) ||
        /ubuntu/.test(userAgent) ||
        /debian/.test(userAgent) ||
        /fedora/.test(userAgent) ||
        /centos/.test(userAgent))
    ) {
      needManualPatse = true;
    }

    const { authUrl, verifier } = await getAuthUrlAndVerifierDropbox(
      this.plugin.settings.dropbox.clientID,
      needManualPatse
    );

    if (needManualPatse) {
      for (const val of t("modal_dropboxauth_manualsteps").split("\n")) {
        contentEl.createEl("p", {
          text: val,
        });
      }
    } else {
      this.plugin.oauth2Info.verifier = verifier;

      for (const val of t("modal_dropboxauth_autosteps").split("\n")) {
        contentEl.createEl("p", {
          text: val,
        });
      }
    }

    const div2 = contentEl.createDiv();
    div2.createEl(
      "button",
      {
        text: t("modal_dropboxauth_copybutton"),
      },
      (el) => {
        el.onclick = async () => {
          await navigator.clipboard.writeText(authUrl);
          new Notice(t("modal_dropboxauth_copynotice"));
        };
      }
    );

    contentEl.createEl("p").createEl("a", {
      href: authUrl,
      text: authUrl,
    });

    if (needManualPatse) {
      let authCode = "";
      new Setting(contentEl)
        .setName(t("modal_dropboxauth_maualinput"))
        .setDesc(t("modal_dropboxauth_maualinput_desc"))
        .addText((text) =>
          text
            .setPlaceholder("")
            .setValue("")
            .onChange((val) => {
              authCode = val.trim();
            })
        )
        .addButton(async (button) => {
          button.setButtonText(t("submit"));
          button.onClick(async () => {
            new Notice(t("modal_dropboxauth_maualinput_notice"));
            try {
              const authRes = await sendAuthReqDropbox(
                this.plugin.settings.dropbox.clientID,
                verifier,
                authCode,
                async (e: unknown) => {
                  new Notice(t("protocol_dropbox_connect_fail"));
                  new Notice(`${e}`);
                  throw e;
                }
              );
              const self = this;
              setConfigBySuccessfullAuthInplace(
                this.plugin.settings.dropbox,
                authRes!,
                () => self.plugin.saveSettings()
              );
              const client = getClient(
                this.plugin.settings,
                this.app.vault.getName(),
                () => this.plugin.saveSettings()
              );
              const username = await client.getUserDisplayName();
              this.plugin.settings.dropbox.username = username;
              await this.plugin.saveSettings();
              new Notice(
                t("modal_dropboxauth_maualinput_conn_succ", {
                  username: username,
                })
              );
              this.authDiv.toggleClass(
                "dropbox-auth-button-hide",
                this.plugin.settings.dropbox.username !== ""
              );
              this.revokeAuthDiv.toggleClass(
                "dropbox-revoke-auth-button-hide",
                this.plugin.settings.dropbox.username === ""
              );
              this.revokeAuthSetting.setDesc(
                t("modal_dropboxauth_maualinput_conn_succ_revoke", {
                  username: this.plugin.settings.dropbox.username,
                })
              );
              this.close();
            } catch (err) {
              console.error(err);
              new Notice(t("modal_dropboxauth_maualinput_conn_fail"));
            }
          });
        });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class DropboxSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "dropbox-settings-section" });
    root.toggleClass(
      "dropbox-hide",
      this.plugin.settings.serviceType !== "dropbox"
    );

    this.addHeader(root, this.t("settings_dropbox"));

    const dropboxLongDescDiv = root.createDiv({
      cls: "settings-long-desc",
    });
    for (const c of [
      this.t("settings_dropbox_disclaimer1"),
      this.t("settings_dropbox_disclaimer2"),
    ]) {
      dropboxLongDescDiv.createEl("p", {
        text: c,
        cls: "dropbox-disclaimer",
      });
    }
    dropboxLongDescDiv.createEl("p", {
      text: this.t("settings_dropbox_folder", {
        pluginID: this.plugin.manifest.id,
        remoteBaseDir:
          this.plugin.settings.dropbox.remoteBaseDir ||
          this.app.vault.getName(),
      }),
    });

    const dropboxSelectAuthDiv = root.createDiv();
    const dropboxAuthDiv = dropboxSelectAuthDiv.createDiv({
      cls: "dropbox-auth-button-hide settings-auth-related",
    });
    const dropboxRevokeAuthDiv = dropboxSelectAuthDiv.createDiv({
      cls: "dropbox-revoke-auth-button-hide settings-auth-related",
    });

    const dropboxRevokeAuthSetting = new Setting(dropboxRevokeAuthDiv)
      .setName(this.t("settings_dropbox_revoke"))
      .setDesc(
        this.t("settings_dropbox_revoke_desc", {
          username: this.plugin.settings.dropbox.username,
        })
      )
      .addButton(async (button) => {
        button.setButtonText(this.t("settings_dropbox_revoke_button"));
        button.onClick(async () => {
          try {
            const client = getClient(
              this.plugin.settings,
              this.app.vault.getName(),
              () => this.plugin.saveSettings()
            );
            await client.revokeAuth();
            this.plugin.settings.dropbox = JSON.parse(
              JSON.stringify(DEFAULT_DROPBOX_CONFIG)
            );
            await this.plugin.saveSettings();
            dropboxAuthDiv.toggleClass(
              "dropbox-auth-button-hide",
              this.plugin.settings.dropbox.username !== ""
            );
            dropboxRevokeAuthDiv.toggleClass(
              "dropbox-revoke-auth-button-hide",
              this.plugin.settings.dropbox.username === ""
            );
            new Notice(this.t("settings_dropbox_revoke_notice"));
          } catch (err) {
            console.error(err);
            new Notice(this.t("settings_dropbox_revoke_noticeerr"));
          }
        });
      });

    new Setting(dropboxRevokeAuthDiv)
      .setName(this.t("settings_dropbox_clearlocal"))
      .setDesc(this.t("settings_dropbox_clearlocal_desc"))
      .addButton(async (button) => {
        button.setButtonText(this.t("settings_dropbox_clearlocal_button"));
        button.onClick(async () => {
          this.plugin.settings.dropbox = JSON.parse(
            JSON.stringify(DEFAULT_DROPBOX_CONFIG)
          );
          await this.plugin.saveSettings();
          dropboxAuthDiv.toggleClass(
            "dropbox-auth-button-hide",
            this.plugin.settings.dropbox.username !== ""
          );
          dropboxRevokeAuthDiv.toggleClass(
            "dropbox-revoke-auth-button-hide",
            this.plugin.settings.dropbox.username === ""
          );
          new Notice(this.t("settings_dropbox_clearlocal_notice"));
        });
      });

    new Setting(dropboxAuthDiv)
      .setName(this.t("settings_dropbox_auth"))
      .setDesc(this.t("settings_dropbox_auth_desc"))
      .addButton(async (button) => {
        button.setButtonText(this.t("settings_dropbox_auth_button"));
        button.onClick(async () => {
          const modal = new DropboxAuthModal(
            this.app,
            this.plugin,
            dropboxAuthDiv,
            dropboxRevokeAuthDiv,
            dropboxRevokeAuthSetting
          );
          this.plugin.oauth2Info.helperModal = modal;
          this.plugin.oauth2Info.authDiv = dropboxAuthDiv;
          this.plugin.oauth2Info.revokeDiv = dropboxRevokeAuthDiv;
          this.plugin.oauth2Info.revokeAuthSetting = dropboxRevokeAuthSetting;
          modal.open();
        });
      });

    dropboxAuthDiv.toggleClass(
      "dropbox-auth-button-hide",
      this.plugin.settings.dropbox.username !== ""
    );
    dropboxRevokeAuthDiv.toggleClass(
      "dropbox-revoke-auth-button-hide",
      this.plugin.settings.dropbox.username === ""
    );

    let newDropboxRemoteBaseDir =
      this.plugin.settings.dropbox.remoteBaseDir || "";
    new Setting(root)
      .setName(this.t("settings_remotebasedir"))
      .setDesc(this.t("settings_remotebasedir_desc"))
      .addText((text) =>
        text
          .setPlaceholder(this.app.vault.getName())
          .setValue(newDropboxRemoteBaseDir)
          .onChange((value) => {
            newDropboxRemoteBaseDir = value.trim();
          })
      )
      .addButton((button) => {
        button.setButtonText(this.t("confirm"));
        button.onClick(() => {
          new ChangeRemoteBaseDirModal(
            this.app,
            this.plugin,
            newDropboxRemoteBaseDir,
            "dropbox"
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
          const res = await client.checkConnect((err: unknown) => {
            errors.msg = `${err}`;
          });
          if (res) {
            new Notice(this.t("settings_dropbox_connect_succ"));
          } else {
            new Notice(this.t("settings_dropbox_connect_fail"));
            new Notice(errors.msg);
          }
        });
      });
  }
}
