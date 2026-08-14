import { expect } from 'chai';
import { ObsidianBridge } from '../obsidian_bridge';
import { testConfig, isPCloudConfigured } from './config';

describe('pCloud Deep Integration Test', function() {
    this.timeout(120000); // pCloud sync can be slow
    const bridge = new ObsidianBridge();
    const TEST_FILE_PATH = 'PCloudDeepTest.md';

    if (!isPCloudConfigured) {
        it.skip('pCloud credentials not configured in .env', () => {});
        return;
    }

    before(async function() {
        if (!(await bridge.isFunctional())) {
            this.skip();
        }
        console.log('Injecting pCloud credentials into Obsidian...');
        const res = await bridge.updatePluginSettings('remotely-save', {
            serviceType: 'pcloud',
            pcloud: {
                accessToken: testConfig.pcloud.token,
                hostname: testConfig.pcloud.hostname,
                locationid: testConfig.pcloud.locationid,
                remoteBaseDir: testConfig.pcloud.remoteBaseDir + '-' + Date.now(),
                kind: 'pcloud',
                emptyFile: 'skip',
            }
        });
        console.log('Update settings result:', res);

        // Reload plugin to ensure settings are picked up
        await bridge.reloadPlugin('remotely-save');
        // Wait for plugin to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    after(async () => {
        // Cleanup local test file
        await bridge.eval(`
            const file = app.vault.getAbstractFileByPath('${TEST_FILE_PATH}');
            if (file) await app.vault.delete(file);
        `);
    });

    it('should sync a new file to pCloud', async () => {
        // 1. Create a local file
        const content = 'This is an E2E test file for pCloud Sync ' + new Date().toISOString();
        await bridge.eval(`await app.vault.create('${TEST_FILE_PATH}', '${content}')`);

        // 2. Trigger Sync
        console.log('Starting pCloud Sync (syncRun)...');
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

        // 3. Verify settings
        const settings = await bridge.getPluginSettings('remotely-save');
        expect(settings.serviceType).to.equal('pcloud');
        console.log('pCloud Sync completed successfully.');
    });
});
