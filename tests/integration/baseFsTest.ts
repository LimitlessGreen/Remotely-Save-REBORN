import { strict as assert } from "assert";
import type { RawFs } from "../../src/core/fs/rawFsInterface";

export function runBaseFsTests(getFs: () => RawFs, rootPath: string) {
  describe(`Base FS Tests at ${rootPath}`, () => {
    let fs: RawFs;
    const testFile = `${rootPath}/test.txt`;
    const testFolder = `${rootPath}/subdir`;
    const testFileInSubdir = `${testFolder}/inner.txt`;
    const content = new TextEncoder().encode("Hello Integration Test");

    before(() => {
      fs = getFs();
    });

    it("should be able to write a file", async () => {
      const now = Date.now();
      const entity = await fs.writeFile(testFile, content.buffer, now, now);
      assert.ok(entity);
      assert.equal(entity.sizeRaw, content.byteLength);
    });

    it("should be able to stat the file", async () => {
      const entity = await fs.stat(testFile);
      assert.ok(entity);
      assert.equal(entity.sizeRaw, content.byteLength);
    });

    it("should be able to read the file", async () => {
      const data = await fs.readFile(testFile);
      const text = new TextDecoder().decode(data);
      assert.equal(text, "Hello Integration Test");
    });

    it("should be able to create a directory", async () => {
      const entity = await fs.mkdir(testFolder);
      assert.ok(entity);
    });

    it("should be able to write a file in a subdirectory", async () => {
      const now = Date.now();
      await fs.writeFile(testFileInSubdir, content.buffer, now, now);
      const entity = await fs.stat(testFileInSubdir);
      assert.equal(entity.sizeRaw, content.byteLength);
    });

    it("should be able to list files (walk)", async () => {
      const entities = await fs.walk(rootPath, false);
      const keys = entities.map(e => e.keyRaw);
      assert.ok(keys.includes(testFile));
      assert.ok(keys.includes(testFolder + "/"));
    });

    it("should be able to delete a file", async () => {
      await fs.rm(testFileInSubdir);
      try {
        await fs.stat(testFileInSubdir);
        assert.fail("File should have been deleted");
      } catch (e) {
        // Expected
      }
    });

    it("should be able to delete a directory (and everything in it, or just the dir if empty)", async () => {
      await fs.rm(testFolder + "/");
      await fs.rm(testFile);

      const entities = await fs.walk(rootPath, false);
      const keys = entities.map(e => e.keyRaw);
      assert.ok(!keys.includes(testFile));
      assert.ok(!keys.includes(testFolder + "/"));
    });
  });
}
