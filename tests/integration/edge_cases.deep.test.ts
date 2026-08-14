import { expect } from 'chai';
import { ObsidianBridge } from '../obsidian_bridge';
import { testConfig, isS3Configured } from './config';

describe('Deep Integration Edge Cases (S3)', function() {
    this.timeout(180000);
    const bridge = new ObsidianBridge();
    const prefix = 'edge-test-' + Date.now();

    if (!isS3Configured) {
        it.skip('S3 credentials not configured in .env', () => {});
        return;
    }

    before(async () => {
        await bridge.updatePluginSettings('remotely-save', {
            serviceType: 's3',
            s3: {
                s3Endpoint: testConfig.s3.endpoint,
                s3Region: testConfig.s3.region,
                s3AccessKeyID: testConfig.s3.accessKeyID,
                s3SecretAccessKey: testConfig.s3.secretAccessKey,
                s3BucketName: testConfig.s3.bucketName,
                remotePrefix: prefix,
                forcePathStyle: true,
            }
        });
        await bridge.reloadPlugin('remotely-save');
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    after(async () => {
        // Cleanup all created files
        await bridge.eval(`
            const files = app.vault.getFiles().filter(f => f.path.startsWith('EdgeTest'));
            for (const f of files) await app.vault.delete(f);
        `);
    });

    it('should sync an empty file (0 bytes)', async () => {
        const path = 'EdgeTest_Empty.md';
        await bridge.eval(`await app.vault.create('${path}', '')`);

        // Verify existence before sync
        const existsBefore = await bridge.eval(`!!app.vault.getAbstractFileByPath('${path}')`);
        expect(existsBefore, 'File should exist before sync').to.be.true;

        console.log('Triggering sync for empty file...');
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

        // Verify it still exists locally
        const existsAfter = await bridge.eval(`!!app.vault.getAbstractFileByPath('${path}')`);
        expect(existsAfter, 'File should still exist after sync').to.be.true;
    });

    it('should sync a file with special characters in name', async () => {
        const path = 'EdgeTest_Specials & (123) [New].md';
        // Note: the bridge handles double quotes, so we use single quotes for the inner JS
        await bridge.eval(`await app.vault.create("${path}", "Content with specials")`);

        const existsBefore = await bridge.eval(`!!app.vault.getAbstractFileByPath("${path}")`);
        expect(existsBefore, 'Special file should exist before sync').to.be.true;

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

        const existsAfter = await bridge.eval(`!!app.vault.getAbstractFileByPath("${path}")`);
        expect(existsAfter, 'Special file should still exist after sync').to.be.true;
    });

    it('should handle local file deletion and sync it to remote', async () => {
        const path = 'EdgeTest_ToDelete.md';
        await bridge.eval(`await app.vault.create('${path}', 'To be deleted')`);

        // Initial sync to upload it
        await bridge.eval(`await app.plugins.getPlugin('remotely-save').syncRun("manual")`);

        // Delete locally
        await bridge.eval(`
            const file = app.vault.getAbstractFileByPath('${path}');
            if (file) await app.vault.delete(file);
        `);

        // Sync again
        const syncResult = await bridge.eval(`
            (async () => {
                try {
                    await app.plugins.getPlugin('remotely-save').syncRun("manual");
                    return "success";
                } catch (e) {
                    return "error: " + e.message;
                }
            })()
        `);
        expect(syncResult).to.equal("success");

        // Verify it remains deleted locally
        const exists = await bridge.eval(`!!app.vault.getAbstractFileByPath('${path}')`);
        expect(exists).to.be.false;
    });
});
