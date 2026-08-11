import { strict as assert } from "assert";
import "../obsidianShim";
import { RawS3Fs } from "../../src/services/s3/S3FileSystem";
import { testConfig, isS3Configured } from "./config";
import { runBaseFsTests } from "./baseFsTest";

if (isS3Configured) {
  describe("S3 Integration Tests", () => {
    const baseConfig = {
      s3Endpoint: testConfig.s3.endpoint,
      s3Region: testConfig.s3.region,
      s3AccessKeyID: testConfig.s3.accessKeyID,
      s3SecretAccessKey: testConfig.s3.secretAccessKey,
      s3BucketName: testConfig.s3.bucketName,
      partsConcurrency: 5,
      forcePathStyle: true,
      remotePrefix: testConfig.s3.remotePrefix,
      useAccurateMTime: true,
      generateFolderObject: false,
    };

    const getFs = (overrides = {}) => new RawS3Fs({ ...baseConfig, ...overrides });

    runBaseFsTests(() => getFs(), testConfig.s3.remotePrefix);

    describe("Extra S3-specific Features", function() {
      this.timeout(30000); // Increase timeout for multipart uploads

      let fs: RawS3Fs;
      before(() => {
        fs = getFs();
      });

      it("should handle large files using multipart upload", async () => {
        // Use 6MB to trigger multipart (usually > 5MB)
        const largeContent = new Uint8Array(6 * 1024 * 1024).fill(0x41);
        const key = `${testConfig.s3.remotePrefix}/large-file-${Date.now()}.bin`;
        const now = Date.now();

        await fs.writeFile(key, largeContent.buffer, now, now);
        const entity = await fs.stat(key);
        assert.equal(entity.sizeRaw, largeContent.byteLength);

        // Clean up
        await fs.rm(key);
      });

      it("should preserve accurate mtime in metadata", async () => {
        const key = `${testConfig.s3.remotePrefix}/mtime-test-${Date.now()}.txt`;
        // Set a fixed date: 2023-01-01 12:00:00 UTC
        const specificMtime = 1672574400000;

        await fs.writeFile(key, new TextEncoder().encode("accurate mtime test").buffer, specificMtime, specificMtime);
        const entity = await fs.stat(key);

        // The plugin stores the specific mtime in Metadata and returns it as mtimeCli
        const diff = Math.abs((entity.mtimeCli || 0) - specificMtime);
        if (diff >= 2000) {
           console.log(`Debug MTime: expected=${specificMtime}, got mtimeCli=${entity.mtimeCli}, mtimeSvr=${entity.mtimeSvr}, diff=${diff}`);
        }
        assert.ok(diff < 2000, `MTime difference too large: ${diff}ms. Expected ~${specificMtime}, got ${entity.mtimeCli}`);

        await fs.rm(key);
      });

      it("should optionally generate folder objects", async () => {
        const fsWithFolders = getFs({ generateFolderObject: true });
        const folderName = `folder-obj-${Date.now()}`;
        const folderKey = `${testConfig.s3.remotePrefix}/${folderName}/`;

        await fsWithFolders.mkdir(folderKey);

        // In S3, if generateFolderObject is true, a walk should see the folder itself as an object
        const entities = await fsWithFolders.walk(testConfig.s3.remotePrefix, false);
        const folderEntity = entities.find(e => e.keyRaw === folderKey);

        assert.ok(folderEntity, "Folder object should exist in listing");
        assert.equal(folderEntity.sizeRaw, 0);

        await fsWithFolders.rm(folderKey);
      });

      it("should support listing and reading old versions", async () => {
        const key = `${testConfig.s3.remotePrefix}/version-test-${Date.now()}.txt`;
        const content1 = new TextEncoder().encode("version 1");
        const content2 = new TextEncoder().encode("version 2");
        const now = Date.now();

        // Write first version
        const e1 = await fs.writeFile(key, content1.buffer, now, now);
        const v1Id = e1.versionId;
        assert.ok(v1Id, "Should have a version ID for first write");

        // Write second version (overwrite)
        const e2 = await fs.writeFile(key, content2.buffer, now + 1000, now + 1000);
        const v2Id = e2.versionId;
        assert.ok(v2Id, "Should have a version ID for second write");
        assert.notEqual(v1Id, v2Id, "Version IDs should be different");

        // List versions
        const versions = await fs.listVersions!(key);
        assert.equal(versions.length, 2, "Should find 2 versions");
        assert.ok(versions.some(v => v.versionId === v1Id));
        assert.ok(versions.some(v => v.versionId === v2Id));

        // Read specific versions
        const read1 = await fs.readFile(key, v1Id);
        assert.equal(new TextDecoder().decode(read1), "version 1");

        const read2 = await fs.readFile(key, v2Id);
        assert.equal(new TextDecoder().decode(read2), "version 2");

        // Clean up all versions
        for (const v of versions) {
          await fs.rm(key, v.versionId);
        }

        // Verify it's gone
        const finalVersions = await fs.listVersions!(key);
        assert.equal(finalVersions.length, 0, "All versions should be deleted");
      });
    });
  });
} else {
  describe("S3 Integration Tests", () => {
    it.skip("S3 not configured in .env", () => {});
  });
}
