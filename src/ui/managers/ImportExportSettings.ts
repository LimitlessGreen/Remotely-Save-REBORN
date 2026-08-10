import cloneDeep from "lodash/cloneDeep";
import { Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../settingsManager";
import type { QRExportType } from "../../core/baseTypes";
import type { TransItemType } from "../../core/i18n/i18n";
import { exportQrCodeUri, importQrCodeUri, parseUriByHand } from "../../utils/importExport";
import type RemotelySavePlugin from "../../main";

class ExportSettingsQrCodeModal extends Modal {
  plugin: RemotelySavePlugin;
  exportType: QRExportType;
  constructor(app: App, plugin: RemotelySavePlugin, exportType: QRExportType) {
    super(app);
    this.plugin = plugin;
    this.exportType = exportType;
  }

  async onOpen() {
    const { contentEl } = this;

    const t = (x: TransItemType, vars?: any) => {
      return this.plugin.i18n.t(x, vars);
    };

    const { rawUri, imgUri } = await exportQrCodeUri(
      this.plugin.settings,
      this.app.vault.getName(),
      this.plugin.manifest.version,
      this.exportType
    );

    const div1 = contentEl.createDiv();
    t("modal_qr_shortdesc")
      .split("\n")
      .forEach((val) => {
        div1.createEl("p", {
          text: val,
        });
      });

    const div2 = contentEl.createDiv();
    div2.createEl(
      "button",
      {
        text: t("modal_qr_button"),
      },
      (el) => {
        el.onclick = async () => {
          await navigator.clipboard.writeText(rawUri);
          new Notice(t("modal_qr_button_notice"));
        };
      }
    );

    const div3 = contentEl.createDiv();
    div3.createEl(
      "img",
      {
        cls: "qrcode-img",
      },
      async (el) => {
        el.src = imgUri;
      }
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class ImportExportSettingsManager extends BaseSettingsManager {
  render(containerEl: HTMLElement): void {
    const { t, plugin, app } = this;

    const importExportDiv = containerEl.createEl("div");
    this.addHeader(importExportDiv, t("settings_importexport"));

    const importExportDivSetting1 = new Setting(importExportDiv)
      .setName(t("settings_export"))
      .setDesc(t("settings_export_desc"));
    importExportDivSetting1.settingEl.addClass("setting-need-wrapping");
    importExportDivSetting1
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_basic_and_advanced_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(
            app,
            plugin,
            "basic_and_advanced"
          ).open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_s3_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(app, plugin, "s3").open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_dropbox_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(
            app,
            plugin,
            "dropbox"
          ).open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_onedrive_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(
            app,
            plugin,
            "onedrive"
          ).open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_onedrivefull_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(
            app,
            plugin,
            "onedrivefull"
          ).open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_webdav_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(app, plugin, "webdav").open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_webdis_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(app, plugin, "webdis").open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_googledrive_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(
            app,
            plugin,
            "googledrive"
          ).open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_box_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(app, plugin, "box").open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_pcloud_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(app, plugin, "pcloud").open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_yandexdisk_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(
            app,
            plugin,
            "yandexdisk"
          ).open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_koofr_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(app, plugin, "koofr").open();
        });
      })
      .addButton(async (button) => {
        button.setButtonText(t("settings_export_azureblobstorage_button"));
        button.onClick(async () => {
          new ExportSettingsQrCodeModal(
            app,
            plugin,
            "azureblobstorage"
          ).open();
        });
      });

    let importSettingVal = "";
    new Setting(importExportDiv)
      .setName(t("settings_import"))
      .setDesc(t("settings_import_desc"))
      .addText((text) =>
        text
          .setPlaceholder("obsidian://remotely-save?func=settings&...")
          .setValue("")
          .onChange((val) => {
            importSettingVal = val;
          })
      )
      .addButton(async (button) => {
        button.setButtonText(t("confirm"));
        button.onClick(async () => {
          if (importSettingVal !== "") {
            try {
              const inputParams = parseUriByHand(importSettingVal);
              const parsed = importQrCodeUri(
                inputParams,
                app.vault.getName()
              );
              if (parsed.status === "error") {
                new Notice(parsed.message);
              } else {
                const copied = cloneDeep(parsed.result);
                plugin.settings = Object.assign(
                  {},
                  plugin.settings,
                  copied
                );
                plugin.saveSettings();
                new Notice(
                  t("protocol_saveqr", {
                    manifestName: plugin.manifest.name,
                  })
                );
              }
            } catch (e) {
              new Notice(`${e}`);
            }

            importSettingVal = "";
          } else {
            new Notice(t("settings_import_error_notice"));
            importSettingVal = "";
          }
        });
      });
  }
}
