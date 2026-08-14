import { expect } from "chai";
import { ObsidianBridge } from "../obsidianBridge";
import { isS3Configured, testConfig } from "./config";

describe("S3 Deep Integration Test", function () {
  this.timeout(120000); // S3 sync can be slow
  const bridge = new ObsidianBridge();
  const TestFilePath = "S3DeepTest.md";

  if (!isS3Configured) {
    it.skip("S3 credentials not configured in .env", () => {});
    return;
  }

  before(async function () {
    if (!(await bridge.isFunctional())) {
      this.skip();
    }
    console.log("Injecting S3 credentials into Obsidian...");
    const res = await bridge.updatePluginSettings("remotely-save", {
      serviceType: "s3",
      s3: {
        s3Endpoint: testConfig.s3.endpoint,
        s3Region: testConfig.s3.region,
        s3AccessKeyID: testConfig.s3.accessKeyID,
        s3SecretAccessKey: testConfig.s3.secretAccessKey,
        s3BucketName: testConfig.s3.bucketName,
        remotePrefix: testConfig.s3.remotePrefix + "-" + Date.now(),
        forcePathStyle: true, // Common for test endpoints like Minio
      },
    });
    console.log("Update settings result:", res);

    // Reload plugin to ensure settings are picked up
    await bridge.reloadPlugin("remotely-save");
    // Wait for plugin to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  after(async () => {
    // Cleanup local test file
    await bridge.eval(`
            const file = app.vault.getAbstractFileByPath('${TestFilePath}');
            if (file) await app.vault.delete(file);
        `);
  });

  it("should sync a new file to S3", async () => {
    // 1. Create a local file
    const content =
      "This is an E2E test file for S3 Sync " + new Date().toISOString();
    await bridge.eval(
      `await app.vault.create('${TestFilePath}', '${content}')`
    );

    // 2. Trigger Sync
    console.log("Starting S3 Sync (syncRun)...");
    const syncResult = await bridge.eval(`
            (async () => {
                const plugin = app.plugins.getPlugin('remotely-save');
                try {
                    await plugin.syncRun("manual");
                    return "success";
                } catch (e) {
                    return "error: " + e.message;
                }
            })()
        `);

    expect(syncResult).to.equal("success");

    // 3. Verify settings
    const settings = await bridge.getPluginSettings("remotely-save");
    expect(settings.serviceType).to.equal("s3");
    console.log("S3 Sync completed successfully.");
  });
});
