import { type App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type {
  SupportedServicesType,
  SupportedServicesTypeWithRemoteBaseDir,
} from "./core/baseTypes";
import type { TFunc, TransItemType } from "./core/i18n/i18n";
import type RemotelySavePlugin from "./main"; // unavoidable
import { SERVICES } from "./services/serviceRegistry";
import { AdvancedSettingsManager } from "./ui/managers/AdvancedSettings";
import { BasicSettingsManager } from "./ui/managers/BasicSettings";
import { DebugSettingsManager } from "./ui/managers/DebugSettings";
import { ImportExportSettingsManager } from "./ui/managers/ImportExportSettings";
import { checkHasSpecialCharForDir } from "./utils/misc";

export class ChangeRemoteBaseDirModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly newRemoteBaseDir: string;
  readonly service: SupportedServicesTypeWithRemoteBaseDir;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    newRemoteBaseDir: string,
    service: SupportedServicesTypeWithRemoteBaseDir
  ) {
    super(app);
    this.plugin = plugin;
    this.newRemoteBaseDir = newRemoteBaseDir;
    this.service = service;
  }

  onOpen() {
    const { contentEl } = this;

    const t: TFunc = (x, vars) => {
      return this.plugin.i18n.t(x, vars);
    };

    contentEl.createEl("h2", { text: t("modal_remotebasedir_title") });
    t("modal_remotebasedir_shortdesc")
      .split("\n")
      .forEach((val, _idx) => {
        contentEl.createEl("p", {
          text: val,
        });
      });

    if (
      this.newRemoteBaseDir === "" ||
      this.newRemoteBaseDir === this.app.vault.getName()
    ) {
      new Setting(contentEl)
        .addButton((button) => {
          button.setButtonText(
            t("modal_remotebasedir_secondconfirm_vaultname")
          );
          button.onClick(async () => {
            // in the settings, the value is reset to the special case ""
            const s =
              (this.service as any) === "nutstore" ? "webdav" : this.service;
            (this.plugin.settings as any)[s].remoteBaseDir = "";
            await this.plugin.saveSettings();
            new Notice(t("modal_remotebasedir_notice"));
            this.close();
          });
          button.setClass("remotebasedir-second-confirm");
        })
        .addButton((button) => {
          button.setButtonText(t("goback"));
          button.onClick(() => {
            this.close();
          });
        });
    } else if (checkHasSpecialCharForDir(this.newRemoteBaseDir)) {
      contentEl.createEl("p", {
        text: t("modal_remotebasedir_invaliddirhint"),
      });
      new Setting(contentEl).addButton((button) => {
        button.setButtonText(t("goback"));
        button.onClick(() => {
          this.close();
        });
      });
    } else {
      new Setting(contentEl)
        .addButton((button) => {
          button.setButtonText(t("modal_remotebasedir_secondconfirm_change"));
          button.onClick(async () => {
            const s =
              (this.service as any) === "nutstore" ? "webdav" : this.service;
            (this.plugin.settings as any)[s].remoteBaseDir =
              this.newRemoteBaseDir;
            await this.plugin.saveSettings();
            new Notice(t("modal_remotebasedir_notice"));
            this.close();
          });
          button.setClass("remotebasedir-second-confirm");
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

export class RemotelySaveSettingTab extends PluginSettingTab {
  readonly plugin: RemotelySavePlugin;

  constructor(app: App, plugin: RemotelySavePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.style.setProperty("overflow-wrap", "break-word");

    containerEl.empty();

    const t: TFunc = (x, vars) => {
      return this.plugin.i18n.t(x, vars);
    };

    containerEl.createEl("h1", { text: "Remotely Save" });

    //////////////////////////////////////////////////
    // below for service chooser
    //////////////////////////////////////////////////

    const serviceChooserDiv = containerEl.createDiv();
    serviceChooserDiv.createEl("h2", { text: t("settings_chooseservice") });

    new Setting(serviceChooserDiv)
      .setName(t("settings_chooseservice"))
      .setDesc(t("settings_chooseservice_desc"))
      .addDropdown(async (dropdown) => {
        dropdown.addOption("s3", t("settings_chooseservice_s3"));
        dropdown.addOption("dropbox", t("settings_chooseservice_dropbox"));
        dropdown.addOption("webdav", t("settings_chooseservice_webdav"));
        dropdown.addOption("onedrive", t("settings_chooseservice_onedrive"));
        dropdown.addOption("webdis", t("settings_chooseservice_webdis"));

        dropdown.addOption(
          "onedrivefull",
          t("settings_chooseservice_onedrivefull")
        );
        dropdown.addOption("box", t("settings_chooseservice_box"));
        dropdown.addOption("pcloud", t("settings_chooseservice_pcloud"));
        dropdown.addOption("koofr", t("settings_chooseservice_koofr"));
        dropdown.addOption(
          "azureblobstorage",
          t("settings_chooseservice_azureblobstorage")
        );
        dropdown.addOption("internxt", t("settings_chooseservice_internxt"));

        dropdown
          .setValue(this.plugin.settings.serviceType)
          .onChange(async (val) => {
            this.plugin.settings.serviceType = val as SupportedServicesType;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    for (const service of SERVICES) {
      service.getSettings(this.plugin, this.app, t).render(containerEl);
    }

    new BasicSettingsManager(this.plugin, this.app, t).render(containerEl);
    new AdvancedSettingsManager(this.plugin, this.app, t).render(containerEl);
    new ImportExportSettingsManager(this.plugin, this.app, t).render(
      containerEl
    );
    new DebugSettingsManager(this.plugin, this.app, t).render(containerEl);
  }

  hide() {
    const { containerEl } = this;
    containerEl.empty();
    super.hide();
  }
}
