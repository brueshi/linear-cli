import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
const CONFIG_DIR = join(homedir(), '.config', 'linear-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    branchStyle: 'feature',
    defaultPriority: 0,
};
/**
 * ConfigManager handles user preferences and defaults
 */
export const ConfigManager = {
    /**
     * Ensure config directory exists
     */
    ensureConfigDir() {
        if (!existsSync(CONFIG_DIR)) {
            mkdirSync(CONFIG_DIR, { recursive: true });
        }
    },
    /**
     * Load configuration from disk
     */
    load() {
        try {
            if (existsSync(CONFIG_FILE)) {
                const content = readFileSync(CONFIG_FILE, 'utf-8');
                return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
            }
        }
        catch {
            // Return defaults if file is corrupted
        }
        return { ...DEFAULT_CONFIG };
    },
    /**
     * Save configuration to disk
     */
    save(config) {
        this.ensureConfigDir();
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    },
    /**
     * Get a specific configuration value
     */
    get(key) {
        const config = this.load();
        return config[key];
    },
    /**
     * Set a specific configuration value
     */
    set(key, value) {
        const config = this.load();
        config[key] = value;
        this.save(config);
    },
    /**
     * Delete a configuration value (reset to default)
     */
    unset(key) {
        const config = this.load();
        delete config[key];
        this.save(config);
    },
    /**
     * Get the config file path (for display purposes)
     */
    getConfigPath() {
        return CONFIG_FILE;
    },
    /**
     * Reset all configuration to defaults
     */
    reset() {
        this.save({ ...DEFAULT_CONFIG });
    },
};
