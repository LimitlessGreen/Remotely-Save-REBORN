import { strict as assert } from "assert";
import "../obsidianShim";
import { RawInternxtFs } from "../../src/services/internxt/InternxtFileSystem";
import { InternxtClient } from "../../src/services/internxt/InternxtClient";
import { testConfig, isInternxtConfigured } from "./config";
import { runBaseFsTests } from "./baseFsTest";

if (isInternxtConfigured) {
  describe("Internxt Integration Tests", function() {
    this.timeout(60000); // Internxt API can be slow

    let activeToken = testConfig.internxt.token;
    let activeMnemonic = testConfig.internxt.mnemonic;
    let activeRootUuid = testConfig.internxt.rootFolderUuid;
    let activeBucketId = testConfig.internxt.bucketId;
    let activeBridgeUser = "";
    let activeUserId = "";

    before(async () => {
      if ((!activeToken || !activeMnemonic || !activeRootUuid || !activeBucketId) && testConfig.internxt.email && testConfig.internxt.password) {
        console.log("Logging into Internxt for integration tests via SDK...");
        const client = new InternxtClient(undefined, { clientName: 'remotely-save-tests', clientVersion: '0.0.1' });
        const res = await client.login(testConfig.internxt.email, testConfig.internxt.password);
        activeToken = res.token;
        activeMnemonic = res.mnemonic;

        // Try to get root UUID from user uuid or rootFolderId
        activeRootUuid = res.user.rootFolderId || res.user.uuid;
        activeBucketId = res.user.bucket;
        activeBridgeUser = res.user.bridgeUser;
        activeUserId = res.user.userId;
      }
    });

    let fsInstance: RawInternxtFs | null = null;
    const getFs = () => {
      if (!fsInstance) {
        fsInstance = new RawInternxtFs({
          email: testConfig.internxt.email || "test@example.com",
          token: activeToken,
          mnemonic: activeMnemonic,
          rootFolderUuid: activeRootUuid,
          bucketId: activeBucketId,
          bridgeUser: activeBridgeUser,
          userId: activeUserId,
          remoteBaseDir: testConfig.internxt.remoteBaseDir,
          kind: "internxt",
        }, async () => { }, { clientName: 'remotely-save-tests', clientVersion: '0.0.1' });
      }
      return fsInstance;
    };

    const rootPath = (testConfig.internxt.remoteBaseDir || "rs-test") + "-" + Date.now();
    runBaseFsTests(getFs, rootPath);

    describe("Internxt Large File & Robustness", () => {
      let fs: RawInternxtFs;
      before(() => {
        fs = getFs();
      });

      it("should handle simultaneous mkdir calls for the same path", async () => {
        const path = `${rootPath}/concurrent-folder`;
        await Promise.all([
          fs.mkdir(path),
          fs.mkdir(path),
          fs.mkdir(path)
        ]);
        const entity = await fs.stat(path + "/");
        assert.ok(entity);
      });

      it("should handle a medium-sized file (sharding test)", async function() {
        this.timeout(120000);
        const key = `${rootPath}/sharding-test.bin`;
        // 10MB to ensure multiple shards
        const content = require('crypto').randomBytes(10 * 1024 * 1024);
        const now = Date.now();

        await fs.writeFile(key, content.buffer, now, now);
        const read = await fs.readFile(key);
        assert.equal(read.byteLength, content.byteLength);

        // Cleanup
        await fs.rm(key);
      });
    });
  });
} else {
  describe("Internxt Integration Tests", () => {
    it.skip("Internxt not configured in .env", () => {});
  });
}
