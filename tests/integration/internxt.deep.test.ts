import { expect } from 'chai';
import { ObsidianBridge } from '../obsidian_bridge';
import { testConfig, isInternxtConfigured } from './config';

describe('Internxt Deep Integration Test', function() {
    this.timeout(120000); // Internxt sync can be slow
    const bridge = new ObsidianBridge();
    const TEST_FILE_PATH = 'InternxtDeepTest.md';

    if (!isInternxtConfigured) {
        it.skip('Internxt credentials not configured in .env', () => {});
        return;
    }

    before(async function() {
        if (!(await bridge.isFunctional())) {
            this.skip();
        }
        console.log('Injecting Internxt credentials into Obsidian...');
        await bridge.updatePluginSettings('remotely-save', {
            serviceType: 'internxt',
            internxt: {
                email: testConfig.internxt.email,
                token: testConfig.internxt.token,
                mnemonic: testConfig.internxt.mnemonic,
                rootFolderUuid: testConfig.internxt.rootFolderUuid,
                bucketId: testConfig.internxt.bucketId,
                remoteBaseDir: '/deep-test-' + Date.now(),
                kind: 'internxt'
            }
        });

        // Reload plugin to ensure settings are picked up
        await bridge.reloadPlugin('remotely-save');
    });

    after(async () => {
        // Cleanup local test file
        await bridge.eval(`
            const file = app.vault.getAbstractFileByPath('${TEST_FILE_PATH}');
            if (file) await app.vault.delete(file);
        `);
    });

    it('should sync a new file to Internxt', async () => {
        // 1. Create a local file
        const content = 'This is an E2E test file for Internxt Sync ' + new Date().toISOString();
        await bridge.eval(`await app.vault.create('${TEST_FILE_PATH}', '${content}')`);

        // 2. Trigger Sync
        console.log('Starting Internxt Sync (syncRun)...');
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

        // 3. Optional: Verify sync status via metadata if available
        const settings = await bridge.getPluginSettings('remotely-save');
        console.log('Sync completed. Service type:', settings.serviceType);
    });
});
