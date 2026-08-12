import { isDeepEqual } from "../../utils/misc";
import { nanoid } from "nanoid";
import type { Entity } from "../baseTypes";

export abstract class FakeFs {
  abstract kind: string;
  abstract walk(): Promise<Entity[]>;
  abstract mkdir(key: string, mtime?: number, ctime?: number): Promise<Entity>;
  abstract writeFile(
    key: string,
    content: ArrayBuffer,
    mtime: number,
    ctime: number
  ): Promise<Entity>;
  abstract readFile(key: string, versionId?: string): Promise<ArrayBuffer>;
  async rename(key1: string, key2: string): Promise<void> {
    throw new Error("Rename not implemented.");
  }
  abstract rm(key: string, versionId?: string): Promise<void>;
  async listVersions?(key: string): Promise<Entity[]>;
  async checkConnect(callbackFunc?: any): Promise<boolean> {
    return await this.checkConnectCommonOps(callbackFunc);
  }
  async checkConnectCommonOps(callbackFunc?: any) {
    try {
      console.info(`check connect: create folder`);
      const folderName = `rs-test-folder-${nanoid()}/`;
      await this.mkdir(folderName);
      // await delay(3000);

      console.info(`check connect: upload file`);
      const filename = `${folderName}rs-test-file-${nanoid()}`;
      const ctime = Date.now();
      const mtime1 = Date.now();
      const content1 = new ArrayBuffer(100);
      await this.writeFile(filename, content1, mtime1, ctime);
      // await delay(3000);

      console.info(`check connect: overwrite file`);
      const mtime2 = Date.now();
      const content2 = new ArrayBuffer(200);
      await this.writeFile(filename, content2, mtime2, ctime);
      // await delay(3000);

      console.info(`check connect: download file`);
      const content3 = await this.readFile(filename);
      if (!isDeepEqual(content2, content3)) {
        throw Error(`downloaded file is not equal with uploaded file!`);
      }
      // await delay(3000);

      console.info(`check connect: delete file`);
      await this.rm(filename);
      // await delay(3000);

      console.info(`check connect: delete folder`);
      await this.rm(folderName);
      // await delay(3000);

      return true;
    } catch (err) {
      console.error(err);
      callbackFunc?.(err);
      return false;
    }
  }
  async getUserDisplayName(): Promise<string> {
    return "Unknown User";
  }
  async revokeAuth(): Promise<any> {
    // do nothing
  }
  allowEmptyFile(): boolean {
    return true;
  }
  async walkPartial(): Promise<Entity[]> {
    return await this.walk();
  }
  async stat(key: string): Promise<Entity> {
    const all = await this.walk();
    const found = all.find(e => e.key === key || e.keyRaw === key);
    if (!found) throw new Error(`Not found: ${key}`);
    return found;
  }
}
