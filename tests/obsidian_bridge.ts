import { spawnSync } from 'child_process';

export class ObsidianBridge {
    private obsidianPath: string;

    constructor() {
        this.obsidianPath = 'obsidian';
    }

    private runCommand(args: string[]): string {
        const result = spawnSync(this.obsidianPath, args, {
            encoding: 'utf8',
            timeout: 120000,
            shell: false
        });
        return result.stdout || '';
    }

    async reloadPlugin(pluginId: string): Promise<void> {
        this.runCommand(['plugin:reload', `id=${pluginId}`]);
    }

    /**
     * The safest way to pass JS code to the Obsidian CLI on all platforms.
     * We hex-encode the code and decode it inside the app context.
     */
    async eval(code: string): Promise<any> {
        const hex = Buffer.from(code).toString('hex');

        // This wrapper is entirely hex-safe for the shell.
        // It decodes the hex and evals it.
        const wrapped = `(async()=>{try{const h='${hex}';let s='';for(let i=0;i<h.length;i+=2)s+=String.fromCharCode(parseInt(h.substr(i,2),16));const r=await eval(s);return JSON.stringify({d:r});}catch(e){return JSON.stringify({e:e.message});}})()`;

        const output = this.runCommand(['eval', `code=${wrapped}`]);
        const cleaned = output.trim();

        if (cleaned.startsWith('=> ')) {
            const jsonPart = cleaned.substring(3);
            if (jsonPart === 'undefined') return undefined;
            try {
                const parsed = JSON.parse(jsonPart);
                if (parsed.e) throw new Error(parsed.e);
                return parsed.d;
            } catch (err) {
                return jsonPart;
            }
        }
        return cleaned;
    }

    async getVaultName(): Promise<string> {
        return this.eval('app.vault.getName()');
    }

    async getPluginSettings(pluginId: string): Promise<any> {
        const result = await this.eval(`JSON.stringify(app.plugins.getPlugin('${pluginId}').settings)`);
        return typeof result === 'string' ? JSON.parse(result) : result;
    }

    async updatePluginSettings(pluginId: string, newSettings: any): Promise<any> {
        const settingsHex = Buffer.from(JSON.stringify(newSettings)).toString('hex');
        return await this.eval(`
            (async () => {
                const plugin = app.plugins.getPlugin('${pluginId}');
                if (!plugin) throw new Error('Plugin ${pluginId} not found');
                const h = '${settingsHex}';
                let s = '';
                for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16));
                const newSets = JSON.parse(s);
                Object.assign(plugin.settings, newSets);
                await plugin.saveSettings();
                return "updated_to_" + plugin.settings.serviceType;
            })()
        `);
    }

    async reloadApp(): Promise<void> {
        await this.eval('window.location.reload()');
    }
}
