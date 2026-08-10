import cloneDeep from "lodash/cloneDeep";
import { type App, Modal, Notice, Setting } from "obsidian";
import { getClient } from "./fsGetter";
import type { TransItemType } from "./i18n";
import type RemotelySavePlugin from "./main";
import { stringToFragment } from "./misc";
import { ChangeRemoteBaseDirModal } from "./settings";
import {
  DEFAULT_BOX_CONFIG,
  generateAuthUrl,
} from "./fsBox";

class BoxAuthModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly authDiv: HTMLDivElement;
  readonly revokeAuthDiv: HTMLDivElement;
  readonly revokeAuthSetting: Setting;
  readonly t: (x: TransItemType, vars?: any) => string;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    authDiv: HTMLDivElement,
    revokeAuthDiv: HTMLDivElement,
    revokeAuthSetting: Setting,
    t: (x: TransItemType, vars?: any) => string
  ) {
    super(app);
    this.plugin = plugin;
    this.authDiv = authDiv;
    this.revokeAuthDiv = revokeAuthDiv;
    this.revokeAuthSetting = revokeAuthSetting;
    this.t = t;
  }

  async onOpen() {
    const { contentEl } = this;
    const t = this.t;

    const authUrl = generateAuthUrl();
    const div2 = contentEl.createDiv();
    div2.createDiv({
      text: stringToFragment(t("modal_boxauth_tutorial")),
    });
    div2.createEl(
      "button",
      {
        text: t("modal_boxauth_copybutton"),
      },
      (el) => {
        el.onclick = async () => {
          await navigator.clipboard.writeText(authUrl);
          new Notice(t("modal_boxauth_copynotice"));
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

class BoxRevokeAuthModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly authDiv: HTMLDivElement;
  readonly revokeAuthDiv: HTMLDivElement;
  readonly t: (x: TransItemType, vars?: any) => string;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    authDiv: HTMLDivElement,
    revokeAuthDiv: HTMLDivElement,
    t: (x: TransItemType, vars?: any) => string
  ) {
    super(app);
    this.plugin = plugin;
    this.authDiv = authDiv;
    this.revokeAuthDiv = revokeAuthDiv;
    this.t = t;
  }

  async onOpen() {
    const t = this.t;
    const { contentEl } = this;

    contentEl.createEl("p", {
      text: t("modal_boxrevokeauth_step1"),
    });
    const consentUrl = "https://app.box.com/account/security";
    contentEl.createEl("p").createEl("a", {
      href: consentUrl,
      text: consentUrl,
    });

    contentEl.createEl("p", {
      text: t("modal_boxrevokeauth_step2"),
    });

    new Setting(contentEl)
      .setName(t("modal_boxrevokeauth_clean"))
      .setDesc(t("modal_boxrevokeauth_clean_desc"))
      .addButton(async (button) => {
        button.setButtonText(t("modal_boxrevokeauth_clean_button"));
        button.onClick(async () => {
          try {
            this.plugin.settings.box = cloneDeep(DEFAULT_BOX_CONFIG);

            await this.plugin.saveSettings();
            this.authDiv.toggleClass(
              "box-auth-button-hide",
              this.plugin.settings.box.refreshToken !== ""
            );
            this.revokeAuthDiv.toggleClass(
              "box-revoke-auth-button-hide",
              this.plugin.settings.box.refreshToken === ""
            );
            new Notice(t("modal_boxrevokeauth_clean_notice"));
            this.close();
          } catch (err) {
            console.error(err);
            new Notice(t("modal_boxrevokeauth_clean_fail"));
          }
        });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export const generateBoxSettingsPart = (
  containerEl: HTMLElement,
  t: (x: TransItemType, vars?: any) => string,
  app: App,
  plugin: RemotelySavePlugin,
  saveUpdatedConfigFunc: () => Promise<any> | undefined
) => {
  const boxDiv = containerEl.createEl("div", {
    cls: "box-hide",
  });
  boxDiv.toggleClass("box-hide", plugin.settings.serviceType !== "box");
  boxDiv.createEl("h2", { text: t("settings_box") });

  const boxLongDescDiv = boxDiv.createEl("div", {
    cls: "settings-long-desc",
  });
  for (const c of [
    t("settings_box_disclaimer1"),
    t("settings_box_disclaimer2"),
  ]) {
    boxLongDescDiv.createEl("p", {
      text: c,
      cls: "box-disclaimer",
    });
  }

  boxLongDescDiv.createEl("p", {
    text: t("settings_box_folder", {
      remoteBaseDir: plugin.settings.box.remoteBaseDir || app.vault.getName(),
    }),
  });

  const boxAllowedToUsedDiv = boxDiv.createDiv();
  const boxSelectAuthDiv = boxAllowedToUsedDiv.createDiv();
  const boxAuthDiv = boxSelectAuthDiv.createDiv({
    cls: "box-auth-button-hide settings-auth-related",
  });
  const boxRevokeAuthDiv = boxSelectAuthDiv.createDiv({
    cls: "box-revoke-auth-button-hide settings-auth-related",
  });

  const boxRevokeAuthSetting = new Setting(boxRevokeAuthDiv)
    .setName(t("settings_box_revoke"))
    .setDesc(t("settings_box_revoke_desc"))
    .addButton(async (button) => {
      button.setButtonText(t("settings_box_revoke_button"));
      button.onClick(async () => {
        new BoxRevokeAuthModal(
          app,
          plugin,
          boxAuthDiv,
          boxRevokeAuthDiv,
          t
        ).open();
      });
    });

  new Setting(boxAuthDiv)
    .setName(t("settings_box_auth"))
    .setDesc(t("settings_box_auth_desc"))
    .addButton(async (button) => {
      button.setButtonText(t("settings_box_auth_button"));
      button.onClick(async () => {
        const modal = new BoxAuthModal(
          app,
          plugin,
          boxAuthDiv,
          boxRevokeAuthDiv,
          boxRevokeAuthSetting,
          t
        );
        plugin.oauth2Info.helperModal = modal;
        plugin.oauth2Info.authDiv = boxAuthDiv;
        plugin.oauth2Info.revokeDiv = boxRevokeAuthDiv;
        plugin.oauth2Info.revokeAuthSetting = boxRevokeAuthSetting;
        modal.open();
      });
    });

  boxAuthDiv.toggleClass(
    "box-auth-button-hide",
    plugin.settings.box.refreshToken !== ""
  );
  boxRevokeAuthDiv.toggleClass(
    "box-revoke-auth-button-hide",
    plugin.settings.box.refreshToken === ""
  );

  let newboxRemoteBaseDir = plugin.settings.box.remoteBaseDir || "";
  new Setting(boxAllowedToUsedDiv)
    .setName(t("settings_remotebasedir"))
    .setDesc(t("settings_remotebasedir_desc"))
    .addText((text) =>
      text
        .setPlaceholder(app.vault.getName())
        .setValue(newboxRemoteBaseDir)
        .onChange((value) => {
          newboxRemoteBaseDir = value.trim();
        })
    )
    .addButton((button) => {
      button.setButtonText(t("confirm"));
      button.onClick(() => {
        new ChangeRemoteBaseDirModal(
          app,
          plugin,
          newboxRemoteBaseDir,
          "box"
        ).open();
      });
    });
  new Setting(boxAllowedToUsedDiv)
    .setName(t("settings_checkonnectivity"))
    .setDesc(t("settings_checkonnectivity_desc"))
    .addButton(async (button) => {
      button.setButtonText(t("settings_checkonnectivity_button"));
      button.onClick(async () => {
        new Notice(t("settings_checkonnectivity_checking"));
        const client = getClient(plugin.settings, app.vault.getName(), () =>
          plugin.saveSettings()
        );
        const errors = { msg: "" };
        const res = await client.checkConnect((err: any) => {
          errors.msg = `${err}`;
        });
        if (res) {
          new Notice(t("settings_box_connect_succ"));
        } else {
          new Notice(t("settings_box_connect_fail"));
          new Notice(errors.msg);
        }
      });
    });

  return {
    boxDiv: boxDiv,
  };
};
