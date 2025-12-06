import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.config', 'linear-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Configuration options for Linear CLI
 */
export interface Config {
  // Default team key (e.g., "ENG")
  defaultTeam?: string;
  
  // Default project ID
  defaultProject?: string;
  
  // Branch naming style: 'feature', 'kebab', or 'plain'
  branchStyle?: 'feature' | 'kebab' | 'plain';
  
  // Default priority for quick issues (0-4)
  defaultPriority?: number;
  
  // Issue templates
  templates?: {
    bug?: { title?: string; description?: string; priority?: number };
    feature?: { title?: string; description?: string; priority?: number };
    task?: { title?: string; description?: string; priority?: number };
  };
  
  // Agent settings
  enableAgentContext?: boolean;   // Default: true - fetch workspace context for AI
  agentConfirmation?: boolean;    // Default: true - show confirmation before creating
  agentModel?: string;            // Default: claude-haiku-4-5-20251001
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Config = {
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
  ensureConfigDir(): void {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
  },

  /**
   * Load configuration from disk
   */
  load(): Config {
    try {
      if (existsSync(CONFIG_FILE)) {
        const content = readFileSync(CONFIG_FILE, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
      }
    } catch {
      // Return defaults if file is corrupted
    }
    return { ...DEFAULT_CONFIG };
  },

  /**
   * Save configuration to disk
   */
  save(config: Config): void {
    this.ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  },

  /**
   * Get a specific configuration value
   */
  get<K extends keyof Config>(key: K): Config[K] {
    const config = this.load();
    return config[key];
  },

  /**
   * Set a specific configuration value
   */
  set<K extends keyof Config>(key: K, value: Config[K]): void {
    const config = this.load();
    config[key] = value;
    this.save(config);
  },

  /**
   * Delete a configuration value (reset to default)
   */
  unset<K extends keyof Config>(key: K): void {
    const config = this.load();
    delete config[key];
    this.save(config);
  },

  /**
   * Get the config file path (for display purposes)
   */
  getConfigPath(): string {
    return CONFIG_FILE;
  },

  /**
   * Reset all configuration to defaults
   */
  reset(): void {
    this.save({ ...DEFAULT_CONFIG });
  },
};

