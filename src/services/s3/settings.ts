import { type App, Modal, Notice, Setting, requireApiVersion } from "obsidian";
import type { TextComponent } from "obsidian";
import type RemotelySavePlugin from "../../main";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { API_VER_ENSURE_REQURL_OK, VALID_REQURL } from "../../baseTypesObs";
import { simpleTransRemotePrefix } from "../../fsS3";
import { getClient } from "../../fsGetter";
import { wrapTextWithPasswordHide } from "../../ui/managers/BasicSettings";

/**
 * s3 is special and do not necessarily the same as others
 * thus a new Modal here
 */
export class ChangeS3RemotePrefixModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly newRemotePrefix: string;
  constructor(app: App, plugin: RemotelySavePlugin, newRemotePrefix: string) {
    super(app);
    this.plugin = plugin;
    this.newRemotePrefix = newRemotePrefix;
  }

  onOpen() {
    const { contentEl } = this;

    const t = (x: string, vars?: any) => {
      return this.plugin.i18n.t(x, vars);
    };

    contentEl.createEl("h2", { text: t("modal_remoteprefix_s3_title") });
    t("modal_remoteprefix_s3_shortdesc")
      .split("\n")
      .forEach((val) => {
        contentEl.createEl("p", {
          text: val,
        });
      });

    contentEl.createEl("p", {
      text: t("modal_remoteprefix_s3_tosave", { prefix: this.newRemotePrefix }),
    });

    if (
      this.newRemotePrefix === "" ||
      this.newRemotePrefix === this.app.vault.getName()
    ) {
      new Setting(contentEl)
        .addButton((button) => {
          button.setButtonText(t("modal_remoteprefix_s3_secondconfirm_empty"));
          button.onClick(async () => {
            // in the settings, the value is reset to the special case ""
            this.plugin.settings.s3.remotePrefix = "";
            await this.plugin.saveSettings();
            new Notice(t("modal_remoteprefix_s3_notice"));
            this.close();
          });
          button.setClass("remoteprefix-second-confirm");
        })
        .addButton((button) => {
          button.setButtonText(t("goback"));
          button.onClick(() => {
            this.close();
          });
        });
    } else {
      new Setting(contentEl)
        .addButton((button) => {
          button.setButtonText(t("modal_remoteprefix_s3_secondconfirm_change"));
          button.onClick(async () => {
            this.plugin.settings.s3.remotePrefix = this.newRemotePrefix;
            await this.plugin.saveSettings();
            new Notice(t("modal_remoteprefix_s3_notice"));
            this.close();
          });
          button.setClass("remoteprefix-s3-second-confirm");
        })
        .addButton((button) => {
          button.setButtonText(t("goback"));
          button.onClick(() => {
            this.close();
          });
        });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class S3Settings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "s3-settings-section" });
    root.toggleClass("s3-hide", this.plugin.settings.serviceType !== "s3");

    this.addHeader(root, this.t("settings_s3"));

    const s3LongDescDiv = root.createDiv({ cls: "settings-long-desc" });

    for (const c of [
      this.t("settings_s3_disclaimer1"),
      this.t("settings_s3_disclaimer2"),
    ]) {
      s3LongDescDiv.createEl("p", {
        text: c,
        cls: "s3-disclaimer",
      });
    }

    if (!VALID_REQURL) {
      s3LongDescDiv.createEl("p", {
        text: this.t("settings_s3_cors"),
      });
    }

    s3LongDescDiv.createEl("p", {
      text: this.t("settings_s3_prod"),
    });

    const s3LinksUl = s3LongDescDiv.createEl("ul");

    s3LinksUl.createEl("li").createEl("a", {
      href: "https://docs.aws.amazon.com/general/latest/gr/s3.html",
      text: this.t("settings_s3_prod1"),
    });

    s3LinksUl.createEl("li").createEl("a", {
      href: "https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-your-credentials.html",
      text: this.t("settings_s3_prod2"),
    });

    if (!VALID_REQURL) {
      s3LinksUl.createEl("li").createEl("a", {
        href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html",
        text: this.t("settings_s3_prod3"),
      });
    }

    new Setting(root)
      .setName(this.t("settings_s3_endpoint"))
      .setDesc(this.t("settings_s3_endpoint"))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.s3.s3Endpoint)
          .onChange(async (value) => {
            this.plugin.settings.s3.s3Endpoint = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(root)
      .setName(this.t("settings_s3_region"))
      .setDesc(this.t("settings_s3_region_desc"))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(`${this.plugin.settings.s3.s3Region}`)
          .onChange(async (value) => {
            this.plugin.settings.s3.s3Region = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(root)
      .setName(this.t("settings_s3_accesskeyid"))
      .setDesc(this.t("settings_s3_accesskeyid_desc"))
      .addText((text) => {
        wrapTextWithPasswordHide(text);
        text
          .setPlaceholder("")
          .setValue(`${this.plugin.settings.s3.s3AccessKeyID}`)
          .onChange(async (value) => {
            this.plugin.settings.s3.s3AccessKeyID = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_s3_secretaccesskey"))
      .setDesc(this.t("settings_s3_secretaccesskey_desc"))
      .addText((text) => {
        wrapTextWithPasswordHide(text);
        text
          .setPlaceholder("")
          .setValue(`${this.plugin.settings.s3.s3SecretAccessKey}`)
          .onChange(async (value) => {
            this.plugin.settings.s3.s3SecretAccessKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_s3_bucketname"))
      .setDesc(this.t("settings_s3_bucketname"))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(`${this.plugin.settings.s3.s3BucketName}`)
          .onChange(async (value) => {
            this.plugin.settings.s3.s3BucketName = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(root)
      .setName(this.t("settings_s3_urlstyle"))
      .setDesc(this.t("settings_s3_urlstyle_desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption(
          "virtualHostedStyle",
          "Virtual Hosted-Style (default)"
        );
        dropdown.addOption("pathStyle", "Path-Style");
        dropdown
          .setValue(
            this.plugin.settings.s3.forcePathStyle
              ? "pathStyle"
              : "virtualHostedStyle"
          )
          .onChange(async (val: string) => {
            this.plugin.settings.s3.forcePathStyle = val === "pathStyle";
            await this.plugin.saveSettings();
          });
      });

    if (VALID_REQURL && !requireApiVersion(API_VER_ENSURE_REQURL_OK)) {
      new Setting(root)
        .setName(this.t("settings_s3_bypasscorslocally"))
        .setDesc(this.t("settings_s3_bypasscorslocally_desc"))
        .addDropdown((dropdown) => {
          dropdown
            .addOption("disable", this.t("disable"))
            .addOption("enable", this.t("enable"));

          dropdown
            .setValue(
              `${
                this.plugin.settings.s3.bypassCorsLocally ? "enable" : "disable"
              }`
            )
            .onChange(async (value) => {
              if (value === "enable") {
                this.plugin.settings.s3.bypassCorsLocally = true;
              } else {
                this.plugin.settings.s3.bypassCorsLocally = false;
              }
              await this.plugin.saveSettings();
            });
        });
    }

    new Setting(root)
      .setName(this.t("settings_s3_parts"))
      .setDesc(this.t("settings_s3_parts_desc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("1", "1");
        dropdown.addOption("2", "2");
        dropdown.addOption("3", "3");
        dropdown.addOption("5", "5");
        dropdown.addOption("10", "10");
        dropdown.addOption("15", "15");
        dropdown.addOption("20", "20 (default)");

        dropdown
          .setValue(`${this.plugin.settings.s3.partsConcurrency}`)
          .onChange(async (val) => {
            const realVal = Number.parseInt(val);
            this.plugin.settings.s3.partsConcurrency = realVal;
            await this.plugin.saveSettings();
          });
      });

    new Setting(root)
      .setName(this.t("settings_s3_accuratemtime"))
      .setDesc(this.t("settings_s3_accuratemtime_desc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("disable", this.t("disable"))
          .addOption("enable", this.t("enable"));

        dropdown
          .setValue(
            `${this.plugin.settings.s3.useAccurateMTime ? "enable" : "disable"}`
          )
          .onChange(async (val) => {
            if (val === "enable") {
              this.plugin.settings.s3.useAccurateMTime = true;
            } else {
              this.plugin.settings.s3.useAccurateMTime = false;
            }
            await this.plugin.saveSettings();
          });
      });

    let newS3RemotePrefix = this.plugin.settings.s3.remotePrefix || "";
    new Setting(root)
      .setName(this.t("settings_remoteprefix_s3"))
      .setDesc(this.t("settings_remoteprefix_s3_desc"))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(newS3RemotePrefix)
          .onChange((value) => {
            newS3RemotePrefix = simpleTransRemotePrefix(value.trim());
          })
      )
      .addButton((button) => {
        button.setButtonText(this.t("confirm"));
        button.onClick(() => {
          new ChangeS3RemotePrefixModal(
            this.app,
            this.plugin,
            simpleTransRemotePrefix(newS3RemotePrefix.trim())
          ).open();
        });
      });
    new Setting(root)
      .setName(this.t("settings_s3_reverse_proxy_no_sign_url"))
      .setDesc(this.t("settings_s3_reverse_proxy_no_sign_url_desc"))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.s3.reverseProxyNoSignUrl ?? "")
          .onChange(async (value) => {
            this.plugin.settings.s3.reverseProxyNoSignUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(root)
      .setName(this.t("settings_s3_generatefolderobject"))
      .setDesc(this.t("settings_s3_generatefolderobject_desc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption(
            "notgenerate",
            this.t("settings_s3_generatefolderobject_notgenerate")
          )
          .addOption(
            "generate",
            this.t("settings_s3_generatefolderobject_generate")
          );

        dropdown
          .setValue(
            `${
              this.plugin.settings.s3.generateFolderObject
                ? "generate"
                : "notgenerate"
            }`
          )
          .onChange(async (val) => {
            if (val === "generate") {
              this.plugin.settings.s3.generateFolderObject = true;
            } else {
              this.plugin.settings.s3.generateFolderObject = false;
            }
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
            errors.msg = err;
          });
          if (res) {
            new Notice(this.t("settings_s3_connect_succ"));
          } else {
            new Notice(this.t("settings_s3_connect_fail"));
            new Notice(errors.msg);
          }
        });
      });
  }
}
