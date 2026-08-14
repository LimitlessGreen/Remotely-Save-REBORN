import * as diff from "diff";
import { type App, Modal, Notice, type TFile } from "obsidian";
import type { Entity } from "../../core/baseTypes";
import { getClient } from "../../core/fs/fsGetter";
import type { TransItemType } from "../../core/i18n/i18n";
import type RemotelySavePlugin from "../../main";

export class VersionHistoryModal extends Modal {
  private readonly plugin: RemotelySavePlugin;
  private readonly file: TFile;
  private versions: Entity[] = [];
  private selectedVersion?: Entity;

  private sidebarEl!: HTMLElement;
  private mainEl!: HTMLElement;
  private diffAreaEl!: HTMLElement;
  private headerTitleEl!: HTMLElement;
  private restoreBtnEl!: HTMLButtonElement;

  constructor(app: App, plugin: RemotelySavePlugin, file: TFile) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.modalEl.addClass("remotely-save-version-history-modal");
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(`Version History: ${this.file.name}`);

    const container = contentEl.createDiv({
      cls: "remotely-save-version-history-container",
    });
    this.sidebarEl = container.createDiv({
      cls: "remotely-save-version-sidebar",
    });
    this.mainEl = container.createDiv({ cls: "remotely-save-version-main" });

    // Header for main area
    const header = this.mainEl.createDiv({
      cls: "remotely-save-version-header",
    });

    const headerTop = header.createDiv({
      cls: "remotely-save-version-header-top",
    });
    this.headerTitleEl = headerTop.createDiv({
      text: "Select a version to compare",
    });
    this.restoreBtnEl = headerTop.createEl("button", {
      text: this.plugin.i18n.t(
        "modal_version_browser_restore" as TransItemType
      ),
      cls: "mod-cta",
    });
    this.restoreBtnEl.style.display = "none";
    this.restoreBtnEl.addEventListener("click", () =>
      this.restoreSelectedVersion()
    );

    this.diffAreaEl = this.mainEl.createDiv({ cls: "remotely-save-diff-area" });
    this.diffAreaEl.createDiv({
      cls: "remotely-save-loader",
      text: "Loading versions...",
    });

    try {
      this.localContent = await this.app.vault.read(this.file);
      await this.loadVersions();
    } catch (err) {
      this.diffAreaEl.setText(
        "Error initializing: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  private async loadVersions() {
    try {
      const client = getClient(
        this.plugin.settings,
        this.app.vault.getName(),
        () => this.plugin.saveSettings(),
        this.plugin.manifest
      );

      if (!client.listVersions) {
        throw new Error("This service does not support versioning.");
      }

      this.versions = await client.listVersions(this.file.path);
      // Sort newest first
      this.versions.sort((a, b) => (b.mtimeSvr || 0) - (a.mtimeSvr || 0));

      this.renderSidebar();

      if (this.versions.length > 0) {
        this.selectVersion(this.versions[0]);
      } else {
        this.diffAreaEl.setText(
          this.plugin.i18n.t(
            "modal_version_browser_no_versions" as TransItemType
          )
        );
      }
    } catch (err) {
      this.diffAreaEl.setText(
        "Error loading versions: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  private renderSidebar() {
    this.sidebarEl.empty();

    // Group versions by day
    const groups: Record<string, Entity[]> = {};
    this.versions.forEach((version) => {
      const day = version.mtimeSvr
        ? (window as any).moment(version.mtimeSvr).format("YYYY-MM-DD")
        : "Unknown";
      if (!groups[day]) groups[day] = [];
      groups[day].push(version);
    });

    const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    sortedDays.forEach((day) => {
      // Day Header
      const headerText =
        day === "Unknown"
          ? "Unknown Date"
          : (window as any).moment(day).calendar(null, {
              sameDay: "[Today]",
              lastDay: "[Yesterday]",
              lastWeek: "dddd, LL",
              sameElse: "dddd, LL",
            });

      this.sidebarEl.createDiv({
        cls: "remotely-save-version-day-header",
        text: headerText,
      });

      // Versions for this day
      groups[day].forEach((version) => {
        const item = this.sidebarEl.createDiv({
          cls: "remotely-save-version-item",
        });
        if (this.selectedVersion?.versionId === version.versionId) {
          item.addClass("is-active");
        }

        const timeStr = version.mtimeSvr
          ? (window as any).moment(version.mtimeSvr).format("HH:mm:ss")
          : "Unknown time";

        item.createSpan({
          cls: "remotely-save-version-item-time",
          text: timeStr,
        });
        item.createSpan({
          cls: "remotely-save-version-item-info",
          text: `${(version.sizeRaw / 1024).toFixed(1)} KB`,
        });

        item.addEventListener("click", () => this.selectVersion(version));
      });
    });
  }

  private async selectVersion(version: Entity) {
    this.selectedVersion = version;
    this.updateDiff();
  }

  private async updateDiff() {
    if (!this.selectedVersion) return;

    this.renderSidebar();
    this.diffAreaEl.empty();
    this.diffAreaEl.createDiv({
      cls: "remotely-save-loader",
      text: "Loading comparison...",
    });
    this.headerTitleEl.setText("Comparing...");
    this.restoreBtnEl.style.display = "none";

    try {
      const client = getClient(
        this.plugin.settings,
        this.app.vault.getName(),
        () => this.plugin.saveSettings(),
        this.plugin.manifest
      );

      // Find the "preceding" version in our sorted list
      // Sorted newest first: [Newest(0), ..., Selected(i), Previous(i+1), ..., Oldest(n)]
      const selectedIndex = this.versions.findIndex(
        (v) => v.versionId === this.selectedVersion?.versionId
      );
      const prevVersion =
        selectedIndex !== -1 && selectedIndex < this.versions.length - 1
          ? this.versions[selectedIndex + 1]
          : undefined;

      // Load Base Content (Previous Version)
      let baseContent = "";
      let baseLabel = "None (Initial Version)";

      if (prevVersion) {
        const baseBuffer = await client.readFile(
          this.file.path,
          prevVersion.versionId
        );
        baseContent = new TextDecoder().decode(baseBuffer);
        baseLabel = (window as any).moment(prevVersion.mtimeSvr).format("LLL");
      }

      // Load Target Content (Selected Version)
      const remoteBuffer = await client.readFile(
        this.file.path,
        this.selectedVersion.versionId
      );
      const remoteText = new TextDecoder().decode(remoteBuffer);

      this.renderDiffInternal(baseContent, remoteText);

      const targetLabel = (window as any)
        .moment(this.selectedVersion.mtimeSvr)
        .format("LLLL");
      this.headerTitleEl.setText(`Changes in version from ${targetLabel}`);
      this.diffAreaEl.createEl(
        "div",
        {
          text: `Comparing with previous version from ${baseLabel}`,
          cls: "remotely-save-diff-unchanged",
          attr: {
            style:
              "font-size: 0.8em; margin-bottom: 10px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 5px;",
          },
        },
        (el) => {
          this.diffAreaEl.prepend(el);
        }
      );

      this.restoreBtnEl.style.display = "block";
    } catch (err) {
      this.diffAreaEl.setText(
        "Error loading content: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  private renderDiffInternal(baseContent: string, targetContent: string) {
    this.diffAreaEl.empty();
    const lineChanges = diff.diffLines(baseContent, targetContent);

    for (let i = 0; i < lineChanges.length; i++) {
      const current = lineChanges[i];
      const next = lineChanges[i + 1];

      if (current.removed && next?.added) {
        this.renderChangedBlock(current.value, next.value);
        i++;
      } else {
        this.renderLineBlock(current);
      }
    }
  }

  private renderChangedBlock(removedText: string, addedText: string) {
    const removedLines = this.splitText(removedText);
    const addedLines = this.splitText(addedText);

    // If same number of lines, we can compare them one by one for word-level diffs
    if (removedLines.length === addedLines.length) {
      for (let i = 0; i < removedLines.length; i++) {
        const wordDiffs = diff.diffWords(removedLines[i], addedLines[i]);

        // 1. Render removed line with highlighted deletions
        const rLine = this.diffAreaEl.createDiv({
          cls: "remotely-save-diff-line remotely-save-diff-removed",
        });
        rLine.createSpan({ text: "- ", cls: "remotely-save-diff-prefix" });
        wordDiffs.forEach((part) => {
          if (part.removed) {
            rLine.createSpan({
              text: part.value,
              cls: "remotely-save-diff-word-removed",
            });
          } else if (!part.added) {
            rLine.createSpan({ text: part.value });
          }
        });

        // 2. Render added line with highlighted additions
        const aLine = this.diffAreaEl.createDiv({
          cls: "remotely-save-diff-line remotely-save-diff-added",
        });
        aLine.createSpan({ text: "+ ", cls: "remotely-save-diff-prefix" });
        wordDiffs.forEach((part) => {
          if (part.added) {
            aLine.createSpan({
              text: part.value,
              cls: "remotely-save-diff-word-added",
            });
          } else if (!part.removed) {
            aLine.createSpan({ text: part.value });
          }
        });
      }
    } else {
      // Different number of lines: just render as separate blocks
      this.renderLineBlock({ value: removedText, removed: true });
      this.renderLineBlock({ value: addedText, added: true });
    }
  }

  private renderLineBlock(part: {
    value: string;
    added?: boolean;
    removed?: boolean;
  }) {
    const cls = part.added
      ? "remotely-save-diff-added"
      : part.removed
        ? "remotely-save-diff-removed"
        : "remotely-save-diff-unchanged";

    const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
    const lines = this.splitText(part.value);

    lines.forEach((line) => {
      this.diffAreaEl.createDiv({
        cls: `remotely-save-diff-line ${cls}`,
        text: prefix + line,
      });
    });
  }

  private splitText(text: string): string[] {
    const lines = text.split(/\r?\n/);
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    return lines;
  }

  private async restoreSelectedVersion() {
    if (!this.selectedVersion) return;

    try {
      new Notice("Restoring file...");
      const client = getClient(
        this.plugin.settings,
        this.app.vault.getName(),
        () => this.plugin.saveSettings(),
        this.plugin.manifest
      );
      const content = await client.readFile(
        this.file.path,
        this.selectedVersion.versionId
      );
      await this.app.vault.modifyBinary(this.file, content);
      new Notice(
        this.plugin.i18n.t(
          "modal_version_browser_notice_restored" as TransItemType
        )
      );
      this.close();
    } catch (err) {
      new Notice(
        "Failed to restore: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
