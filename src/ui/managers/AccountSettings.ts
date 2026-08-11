import cloneDeep from "lodash/cloneDeep";
import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../settingsManager";
import type { FeatureInfo, OfficialAccountConfig as AccountConfig } from "../../core/baseTypes";
import type { TransItemType } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";
import { stringToFragment } from "../../utils/misc";
import {
  DEFAULT_ACCOUNT_CONFIG,
  generateAuthUrlAndCodeVerifierChallenge,
  getAndSaveAccountEmail,
  getAndSaveAccountFeatures,
  sendAuthReq,
  setConfigBySuccessfullAuthInplace,
} from "../../auth/account";

export class AccountAuthModal extends Modal {
  constructor(
    app: App,
    private plugin: RemotelySavePlugin,
    private authDiv: HTMLElement,
    private revokeDiv: HTMLElement,
    private featuresSetting: Setting,
    private t: (x: TransItemType, vars?: any) => string
  ) {
    super(app);
  }

  async onOpen() {
    const { contentEl } = this;
    const { authUrl, codeVerifier } = await generateAuthUrlAndCodeVerifierChallenge(false);
    this.plugin.oauth2Info.verifier = codeVerifier;

    const div = contentEl.createDiv();
    div.createEl("button", { text: this.t("modal_proauth_copybutton") }, (el) => {
      el.onclick = async () => {
        await navigator.clipboard.writeText(authUrl);
        new Notice(this.t("modal_proauth_copynotice"));
      };
    });

    contentEl.createEl("p").createEl("a", { href: authUrl, text: authUrl });

    let authCode = "";
    new Setting(contentEl)
      .setName(this.t("modal_proauth_maualinput"))
      .addText(text => text.onChange(v => authCode = v.trim()))
      .addButton(btn => btn
        .setButtonText(this.t("submit"))
        .onClick(async () => {
          new Notice(this.t("modal_proauth_maualinput_notice"));
          try {
            const authRes = await sendAuthReq(codeVerifier, authCode, (e: any) => { throw e; });
            await setConfigBySuccessfullAuthInplace(this.plugin.settings.officialAccount!, authRes, () => this.plugin.saveSettings());
            await getAndSaveAccountFeatures(this.plugin.settings.officialAccount!, this.plugin.manifest.version, () => this.plugin.saveSettings());
            await getAndSaveAccountEmail(this.plugin.settings.officialAccount!, this.plugin.manifest.version, () => this.plugin.saveSettings());

            new Notice(this.t("protocol_pro_connect_manualinput_succ"));
            this.refreshUI();
            this.close();
          } catch (err) {
            new Notice(this.t("modal_proauth_maualinput_conn_fail"));
          }
        })
      );
  }

  private refreshUI() {
    const linked = !!this.plugin.settings.officialAccount?.refreshToken;
    this.authDiv.toggleClass("pro-auth-button-hide", linked);
    this.revokeDiv.toggleClass("pro-revoke-auth-button-hide", !linked);
  }
}

export class AccountSettingsManager extends BaseSettingsManager {
  render(containerEl: HTMLElement): void {
    const { t, plugin, app } = this;
    const root = containerEl.createDiv();
    this.addHeader(root, t("settings_pro"));
    root.createEl("p", { text: stringToFragment(t("settings_pro_tutorial")) });

    const authDiv = root.createDiv({ cls: "settings-auth-related" });
    const revokeDiv = root.createDiv({ cls: "settings-auth-related" });

    const featuresSetting = new Setting(revokeDiv)
      .setName(t("settings_pro_features"))
      .setDesc(this.getFeaturesText());

    featuresSetting.addButton(btn => btn
      .setButtonText(t("settings_pro_features_refresh_button"))
      .onClick(async () => {
        if (!plugin.settings.officialAccount) return;
        await getAndSaveAccountFeatures(plugin.settings.officialAccount, plugin.manifest.version, () => plugin.saveSettings());
        featuresSetting.setDesc(this.getFeaturesText());
      })
    );

    new Setting(revokeDiv)
      .setName(t("settings_pro_revoke"))
      .addButton(btn => btn
        .setButtonText(t("settings_pro_revoke_button"))
        .onClick(async () => {
          plugin.settings.officialAccount = cloneDeep(DEFAULT_ACCOUNT_CONFIG);
          await plugin.saveSettings();
          this.refreshVisibility(authDiv, revokeDiv);
        })
      );

    new Setting(authDiv)
      .setName(t("settings_pro_intro"))
      .addButton(btn => btn
        .setButtonText(t("settings_pro_intro_button"))
        .onClick(() => window.open("https://remotelysave.com"))
      );

    new Setting(authDiv)
      .setName(t("settings_pro_auth"))
      .addButton(btn => btn
        .setButtonText(t("settings_pro_auth_button"))
        .onClick(() => new AccountAuthModal(app, plugin, authDiv, revokeDiv, featuresSetting, t).open())
      );

    this.refreshVisibility(authDiv, revokeDiv);
  }

  private getFeaturesText(): string {
    const features = this.plugin.settings.officialAccount?.enabledFeatures || [];
    if (features.length === 0) return "No features enabled.";
    return features.map(f => f.featureName).join(", ");
  }

  private refreshVisibility(auth: HTMLElement, revoke: HTMLElement) {
    const linked = !!this.plugin.settings.officialAccount?.refreshToken;
    auth.toggleClass("pro-auth-button-hide", linked);
    revoke.toggleClass("pro-revoke-auth-button-hide", !linked);
  }
}
