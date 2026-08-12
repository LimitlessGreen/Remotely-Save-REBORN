import { strict as assert } from "assert";
import "../obsidianShim";
import { InternxtClient } from "../../src/services/internxt/InternxtClient";
import { testConfig, isInternxtConfigured } from "./config";

if (isInternxtConfigured) {
  describe("Internxt Findings Tests", function() {
    this.timeout(60000);

    let client: InternxtClient;
    let folderUuid: string;

    before(async () => {
        const loginClient = new InternxtClient();
        const res = await loginClient.login(testConfig.internxt.email, testConfig.internxt.password);
        client = new InternxtClient({
            token: res.token,
            mnemonic: res.mnemonic,
            bridgeUser: res.user.bridgeUser,
            userId: res.user.userId,
            rootFolderUuid: res.user.rootFolderId || res.user.uuid,
            bucketId: res.user.bucket
        });

        const folder = await client.createFolder(res.user.rootFolderId || res.user.uuid, 'findings-test-' + Date.now());
        folderUuid = folder.uuid;
    });

    it("should upload a file and have it visible with correct name", async () => {
        const filename = "test-file-" + Date.now() + ".md";
        const content = require('crypto').randomBytes(100);
        await client.uploadFile(folderUuid, filename, content, content.length);

        const contents = await client.getFolderContents(folderUuid);
        const found = contents.files.find((f: any) => f.plainName === filename);

        assert.ok(found, "File should be found by plainName");
        assert.ok(found.name, "File should have an encrypted name");
        assert.equal(found.plainName, filename, "PlainName should match exactly (no double extension)");
    });

    after(async () => {
        if (folderUuid) {
            await client.deleteFolder(folderUuid);
        }
    });
  });
}
