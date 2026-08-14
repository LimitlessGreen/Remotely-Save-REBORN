import "./../obsidianShim";
import { Auth, Drive } from "@internxt/sdk";
import { expect } from "chai";
import sinon from "sinon";
import { InternxtClient } from "../../src/services/internxt/InternxtClient";

describe("Internxt Service Tests", () => {
  let authStub: sinon.SinonStub;
  let storageStub: sinon.SinonStub;

  beforeEach(() => {
    authStub = sinon.stub(Auth, "client");
    storageStub = sinon.stub(Drive.Storage, "client");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should initialize with correct URLs", () => {
    const config = {
      token: "token",
      mnemonic: "mnemonic",
      bridgeUser: "user",
      userId: "id",
      rootFolderUuid: "root",
      bucketId: "bucket",
    };

    new InternxtClient(config);

    expect(authStub.calledOnce).to.be.true;
    expect(storageStub.calledOnce).to.be.true;

    const apiUrl = "https://gateway.internxt.com/drive";
    expect(authStub.firstCall.args[0]).to.equal(apiUrl);
    expect(storageStub.firstCall.args[0]).to.equal(apiUrl);
  });

  it("should login correctly (mocked)", async () => {
    const loginWithoutKeysStub = sinon.stub().resolves({
      newToken: "new-token",
      user: {
        mnemonic: "encrypted-mnemonic",
        rootFolderId: "root",
        bucket: "bucket",
      },
    });

    authStub.returns({
      loginWithoutKeys: loginWithoutKeysStub,
    });

    const client = new InternxtClient();

    // We need to bypass actual crypto for mnemonic decryption in this simple test
    // or just mock the decryption method.
    (client as any).decryptMnemonic = sinon
      .stub()
      .returns("decrypted-mnemonic");

    const res = await client.login("test@example.com", "password");

    expect(res.token).to.equal("new-token");
    expect(res.mnemonic).to.equal("decrypted-mnemonic");
  });
});
