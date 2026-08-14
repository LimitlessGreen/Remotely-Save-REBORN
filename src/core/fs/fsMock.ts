import type { Entity } from "../baseTypes";
import { FakeFs } from "./fsAll";

export class FakeFsMock extends FakeFs {
  kind: "mock";

  constructor() {
    super();
    this.kind = "mock";
  }

  async walk(): Promise<Entity[]> {
    throw new Error("Method not implemented.");
  }

  async walkPartial(): Promise<Entity[]> {
    return await this.walk();
  }

  async stat(_key: string): Promise<Entity> {
    throw new Error("Method not implemented.");
  }

  async mkdir(_key: string, _mtime: number, _ctime: number): Promise<Entity> {
    throw new Error("Method not implemented.");
  }

  async writeFile(
    _key: string,
    _content: ArrayBuffer,
    _mtime: number,
    _ctime: number
  ): Promise<Entity> {
    throw new Error("Method not implemented.");
  }

  async readFile(_key: string): Promise<ArrayBuffer> {
    throw new Error("Method not implemented.");
  }

  async rename(_key1: string, _key2: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async rm(_key: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async checkConnect(callbackFunc?: (err?: unknown) => void): Promise<boolean> {
    return await this.checkConnectCommonOps(callbackFunc);
  }

  async getUserDisplayName(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async revokeAuth(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  allowEmptyFile(): boolean {
    throw new Error("Method not implemented.");
  }
}
