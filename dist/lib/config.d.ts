/**
 * Configuration options for Linear CLI
 */
export interface Config {
    defaultTeam?: string;
    defaultProject?: string;
    branchStyle?: 'feature' | 'kebab' | 'plain';
    defaultPriority?: number;
    templates?: {
        bug?: {
            title?: string;
            description?: string;
            priority?: number;
        };
        feature?: {
            title?: string;
            description?: string;
            priority?: number;
        };
        task?: {
            title?: string;
            description?: string;
            priority?: number;
        };
    };
    enableAgentContext?: boolean;
    agentConfirmation?: boolean;
    agentModel?: string;
}
/**
 * ConfigManager handles user preferences and defaults
 */
export declare const ConfigManager: {
    /**
     * Ensure config directory exists
     */
    ensureConfigDir(): void;
    /**
     * Load configuration from disk
     */
    load(): Config;
    /**
     * Save configuration to disk
     */
    save(config: Config): void;
    /**
     * Get a specific configuration value
     */
    get<K extends keyof Config>(key: K): Config[K];
    /**
     * Set a specific configuration value
     */
    set<K extends keyof Config>(key: K, value: Config[K]): void;
    /**
     * Delete a configuration value (reset to default)
     */
    unset<K extends keyof Config>(key: K): void;
    /**
     * Get the config file path (for display purposes)
     */
    getConfigPath(): string;
    /**
     * Reset all configuration to defaults
     */
    reset(): void;
};
