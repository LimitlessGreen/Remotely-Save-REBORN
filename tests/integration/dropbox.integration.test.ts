import { strict as assert } from "assert";
import "../obsidianShim";
import { RawDropboxFs } from "../../src/services/dropbox/DropboxFileSystem";
import { testConfig, isDropboxConfigured } from "./config";
import { runBaseFsTests } from "./baseFsTest";

if (isDropboxConfigured) {
  describe("Dropbox Integration Tests", function() {
    this.timeout(30000); // Increase timeout for real network calls

    const getFs = () => new RawDropboxFs({
      accessToken: testConfig.dropbox.token,
      clientID: "",
      refreshToken: "",
      accessTokenExpiresInSeconds: 3600,
      accessTokenExpiresAtTime: Date.now() + 3600 * 1000,
      accountID: "",
      username: "test-user",
    }, async () => {});

    const rootPath = testConfig.dropbox.remoteBaseDir;
    runBaseFsTests(getFs, rootPath);

    describe("Dropbox Versioning", () => {
      let fs: RawDropboxFs;
      before(() => {
        fs = getFs();
      });

      it("should support listing and reading old revisions", async () => {
        const key = `${rootPath}/rev-test-${Date.now()}.txt`;
        const content1 = new TextEncoder().encode("rev 1");
        const content2 = new TextEncoder().encode("rev 2");
        const now = Date.now();

        // Write first revision
        const e1 = await fs.writeFile(key, content1.buffer, now);
        const v1Id = e1.versionId;
        assert.ok(v1Id, "Should have a rev ID for first write");

        // Write second revision (overwrite)
        const e2 = await fs.writeFile(key, content2.buffer, now + 1000);
        const v2Id = e2.versionId;
        assert.ok(v2Id, "Should have a rev ID for second write");
        assert.notEqual(v1Id, v2Id, "Rev IDs should be different");

        // List revisions
        const versions = await fs.listVersions!(key);
        assert.ok(versions.length >= 2, "Should find at least 2 revisions");
        assert.ok(versions.some(v => v.versionId === v1Id));
        assert.ok(versions.some(v => v.versionId === v2Id));

        // Read specific revisions
        const read1 = await fs.readFile(key, v1Id);
        assert.equal(new TextDecoder().decode(read1), "rev 1");

        const read2 = await fs.readFile(key, v2Id);
        assert.equal(new TextDecoder().decode(read2), "rev 2");

        // Clean up
        await fs.rm(key);
      });
    });
  });
} else {
  describe("Dropbox Integration Tests", () => {
    it.skip("Dropbox not configured in .env", () => {});
  });
}
