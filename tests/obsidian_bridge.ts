import { execSync } from 'child_process';

export class ObsidianBridge {
    private obsidianPath: string;

    constructor() {
        this.obsidianPath = 'obsidian';
    }

    /**
     * Executes a command via the Obsidian CLI.
     */
    private runCommand(args: string[]): string {
        const fullCommand = `${this.obsidianPath} ${args.join(' ')}`;
        try {
            const output = execSync(fullCommand, {
                encoding: 'utf8',
                timeout: 120000,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            return output;
        } catch (error: any) {
            if (error.code === 'ETIMEDOUT') {
                throw new Error(`Obsidian CLI command timed out: ${fullCommand}`);
            }
            throw new Error(`Obsidian CLI error: ${error.message}\nStdout: ${error.stdout}\nStderr: ${error.stderr}`);
        }
    }

    /**
     * Reloads a plugin.
     */
    async reloadPlugin(pluginId: string): Promise<void> {
        this.runCommand(['plugin:reload', `id=${pluginId}`]);
    }

    /**
     * Evaluates JavaScript code in Obsidian and returns the result.
     */
    async eval(code: string): Promise<any> {
        // Minify code slightly to avoid shell escaping issues with newlines
        const minifiedCode = code.replace(/\n/g, ' ').replace(/\s\s+/g, ' ').trim();
        // Escape backslashes and double quotes
        const escapedCode = minifiedCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const output = this.runCommand(['eval', `code="${escapedCode}"`]);

        const cleanedOutput = output.trim();
        if (cleanedOutput.startsWith('=> ')) {
            const result = cleanedOutput.substring(3);

            // Handle common primitive returns
            if (result === 'true') return true;
            if (result === 'false') return false;
            if (result === 'undefined') return undefined;
            if (result === 'null') return null;
            if (!isNaN(Number(result)) && result !== '') return Number(result);

            // If it looks like JSON (starts with { or [), try to parse it
            if ((result.startsWith('{') && result.endsWith('}')) ||
                (result.startsWith('[') && result.endsWith(']'))) {
                try {
                    return JSON.parse(result);
                } catch (e) {
                    // Fall back to raw string
                }
            }
            return result;
        }
        return cleanedOutput;
    }

    async getVaultName(): Promise<string> {
        return this.eval('app.vault.getName()');
    }

    async getPluginSettings(pluginId: string): Promise<any> {
        // Return stringified to ensure we can parse it back
        const result = await this.eval(`JSON.stringify(app.plugins.getPlugin('${pluginId}').settings)`);
        try {
            if (typeof result === 'object') return result;
            return JSON.parse(result);
        } catch (e) {
            throw new Error(`Failed to parse settings: ${result}`);
        }
    }

    /**
     * Updates plugin settings by merging the provided partial settings.
     */
    async updatePluginSettings(pluginId: string, newSettings: any): Promise<void> {
        const escapedSettings = JSON.stringify(newSettings).replace(/"/g, '\\"');
        await this.eval(`
            const plugin = app.plugins.getPlugin('${pluginId}');
            const newSettings = JSON.parse("${escapedSettings}");
            plugin.settings = Object.assign({}, plugin.settings, newSettings);
            await plugin.saveSettings();
        `);
    }

    /**
     * Reloads the app (useful if settings injection requires a fresh start)
     */
    async reloadApp(): Promise<void> {
        await this.eval('window.location.reload()');
    }
}
