import { expect } from "chai";
import { ObsidianBridge } from "../obsidianBridge";
import { isAnyCloudConfigured } from "./config";

describe("Sync Workflow Deep Integration", function () {
  this.timeout(60000);
  const bridge = new ObsidianBridge();
  const TestFilePath = "DeepTestFile.md";

  before(async function () {
    if (!(await bridge.isFunctional())) {
      this.skip();
    }
    if (!isAnyCloudConfigured) {
      console.log(
        "Skipping Deep Integration tests: No cloud credentials configured."
      );
      this.skip();
    }
    // Ensure plugin is fresh
    await bridge.reloadPlugin("remotely-save");
  });

  after(async () => {
    // Cleanup test file
    await bridge.eval(`
            const file = app.vault.getAbstractFileByPath('${TestFilePath}');
            if (file) await app.vault.delete(file);
        `);
  });

  it("should create a file via app.vault and check its existence", async () => {
    const path = TestFilePath;
    await bridge.eval(`
            (async () => {
                const p = "${path}";
                const f = app.vault.getAbstractFileByPath(p);
                if (f) await app.vault.delete(f);
                await app.vault.create(p, "Content from Deep Integration Test " + Date.now());
            })()
        `);

    // Wait a short moment
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Try to find it in the list of all files to be sure
    const allFiles = await bridge.eval("app.vault.getFiles().map(f => f.path)");
    console.log("Files in vault:", allFiles);
    expect(allFiles).to.include(path);
  });

  it("should trigger a sync via the plugin instance", async function () {
    this.timeout(120000); // Sync can take a while

    const syncResult = await bridge.eval(`
            (async () => {
                const plugin = app.plugins.getPlugin('remotely-save');
                if (!plugin) return "Plugin not found";
                try {
                    await plugin.syncRun("manual");
                    return "success";
                } catch (e) {
                    return "error: " + e.message;
                }
            })()
        `);

    expect(syncResult).to.equal("success");
  });

  it("should verify sync status in logs or state", async () => {
    // Example: checking a 'lastSyncTime' or similar metadata
    const settings = await bridge.getPluginSettings("remotely-save");
    // This depends on your specific settings structure
    console.log("Last sync settings snapshot:", settings);
  });
});
