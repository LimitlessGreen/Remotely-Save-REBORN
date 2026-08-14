import { expect } from 'chai';
import { ObsidianBridge } from '../obsidian_bridge';

describe('Obsidian Deep Integration Smoke Test', function() {
    this.timeout(15000);
    const bridge = new ObsidianBridge();

    it('should connect to Obsidian and read the vault name', async () => {
        const vaultName = await bridge.getVaultName();
        console.log(`Connected to vault: ${vaultName}`);
        expect(vaultName).to.equal('DevVault');
    });

    it('should verify that remotely-save is loaded', async () => {
        const pluginEnabled = await bridge.eval("!!app.plugins.getPlugin('remotely-save')");
        expect(pluginEnabled).to.be.true;
    });

    it('should read remotely-save settings', async () => {
        const settings = await bridge.getPluginSettings('remotely-save');
        expect(settings).to.have.property('serviceType');
        console.log(`Plugin service type: ${settings.serviceType}`);
    });
});
