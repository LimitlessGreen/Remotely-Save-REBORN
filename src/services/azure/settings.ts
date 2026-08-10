import { type App, Modal, Notice, Setting } from "obsidian";
import { BaseSettingsManager } from "../../ui/settingsManager";
import { DEFAULT_AZUREBLOBSTORAGE_CONFIG } from "./fsAzureBlobStorage";
import { wrapTextWithPasswordHide } from "../../settings";

export class AzureSettings extends BaseSettingsManager {
  render(containerEl: HTMLElement) {
    const root = containerEl.createDiv({ cls: "azure-settings-section" });
    root.toggleClass("azure-hide", this.plugin.settings.serviceType !== "azureblobstorage");

    this.addHeader(root, this.t("settings_azureblobstorage"));
    this.addDescription(root, this.t("settings_azureblobstorage_disclaimer1"));

    this.addConnectionSettings(root);
  }

  private addConnectionSettings(el: HTMLElement) {
    new Setting(el)
      .setName(this.t("settings_azureblobstorage_containersasurl"))
      .addText(text => {
        wrapTextWithPasswordHide(text);
        text.setValue(this.plugin.settings.azureblobstorage.containerSasUrl)
          .onChange(async v => {
            this.plugin.settings.azureblobstorage.containerSasUrl = v.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(el)
      .setName(this.t("settings_azureblobstorage_containername"))
      .addText(text => {
        text.setValue(this.plugin.settings.azureblobstorage.containerName)
          .onChange(async v => {
            this.plugin.settings.azureblobstorage.containerName = v.trim();
            await this.plugin.saveSettings();
          });
      });
  }
}
