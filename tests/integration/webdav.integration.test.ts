import { strict as assert } from "assert";
import "../obsidianShim";
import { RawWebdavFs } from "../../src/services/webdav/WebdavFileSystem";
import { runBaseFsTests } from "./baseFsTest";
import { isWebdavConfigured, testConfig } from "./config";

if (isWebdavConfigured) {
  describe("WebDAV Integration Tests", function () {
    this.timeout(60000); // Higher timeout for WebDAV

    const getFs = () =>
      new RawWebdavFs(
        {
          address: testConfig.webdav.address,
          username: testConfig.webdav.username,
          password: testConfig.webdav.password,
          authType: "basic",
          depth: "manual_1",
          remoteBaseDir: "rs-test",
          manualRecursive: false,
        },
        async () => {}
      );

    // For WebDAV, the path in the test should be relative to the server address
    // or include the base directory as configured.
    const rootPath = "/rs-test";
    runBaseFsTests(getFs, rootPath);

    describe("WebDAV (Nextcloud) Versioning", () => {
      let fs: RawWebdavFs;
      before(() => {
        fs = getFs();
      });

      it("should support listing and reading old versions on Nextcloud", async () => {
        const key = `${rootPath}/version-test-${Date.now()}.txt`;
        const content1 = new TextEncoder().encode("v1 content");
        const content2 = new TextEncoder().encode("v2 content");
        const now = Date.now();

        // Write first version
        await fs.writeFile(key, content1.buffer, now, now);

        // Wait a bit because Nextcloud versioning is timestamp based (1s resolution)
        await new Promise((r) => setTimeout(r, 1500));

        // Write second version (overwrite)
        await fs.writeFile(key, content2.buffer, now + 2000, now + 2000);

        // List versions
        const versions = await fs.listVersions?.(key);
        // Note: Nextcloud creates versions when a file is OVERWRITTEN.
        assert.ok(versions.length >= 1, "Should find at least one old version");

        const v1 = versions.find((v) => v.sizeRaw === content1.byteLength);
        assert.ok(v1, "Should find old version by size");
        assert.ok(v1.versionId, "Should have a versionId");

        // Read the old version
        const readV1 = await fs.readFile(key, v1.versionId);
        assert.equal(new TextDecoder().decode(readV1), "v1 content");

        // Clean up
        await fs.rm(key);
      });
    });
  });
} else {
  describe("WebDAV Integration Tests", () => {
    it.skip("WebDAV not configured in .env", () => {});
  });
}
