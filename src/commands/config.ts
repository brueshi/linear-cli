import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager, type Config } from '../lib/config.js';

/**
 * Valid configuration keys and their descriptions
 */
const CONFIG_KEYS: Record<keyof Config, { description: string; validate?: (v: string) => boolean; parse?: (v: string) => unknown }> = {
  defaultTeam: {
    description: 'Default team key (e.g., ENG)',
  },
  defaultProject: {
    description: 'Default project ID',
  },
  branchStyle: {
    description: 'Branch naming style: feature, kebab, or plain',
    validate: (v) => ['feature', 'kebab', 'plain'].includes(v),
    parse: (v) => v as Config['branchStyle'],
  },
  defaultPriority: {
    description: 'Default priority for quick issues (0-4)',
    validate: (v) => /^[0-4]$/.test(v),
    parse: (v) => parseInt(v, 10),
  },
  templates: {
    description: 'Issue templates (use JSON format)',
    parse: (v) => JSON.parse(v),
  },
};

export function registerConfigCommands(program: Command): void {
  const config = program
    .command('config')
    .description('Manage CLI configuration');

  // ─────────────────────────────────────────────────────────────────
  // SET COMMAND
  // ─────────────────────────────────────────────────────────────────
  config
    .command('set <key> <value>')
    .description('Set a configuration option')
    .action((key: string, value: string) => {
      const configKey = key as keyof Config;
      
      if (!(configKey in CONFIG_KEYS)) {
        console.log(chalk.red(`Unknown configuration key: ${key}`));
        console.log('');
        console.log('Available keys:');
        for (const [k, v] of Object.entries(CONFIG_KEYS)) {
          console.log(`  ${chalk.cyan(k)}: ${v.description}`);
        }
        process.exit(1);
      }
      
      const keyConfig = CONFIG_KEYS[configKey];
      
      // Validate if validator exists
      if (keyConfig.validate && !keyConfig.validate(value)) {
        console.log(chalk.red(`Invalid value for ${key}: ${value}`));
        console.log(chalk.gray(keyConfig.description));
        process.exit(1);
      }
      
      // Parse and save
      const parsedValue = keyConfig.parse ? keyConfig.parse(value) : value;
      ConfigManager.set(configKey, parsedValue as Config[typeof configKey]);
      
      console.log(chalk.green(`Set ${chalk.cyan(key)} = ${chalk.bold(value)}`));
    });

  // ─────────────────────────────────────────────────────────────────
  // GET COMMAND
  // ─────────────────────────────────────────────────────────────────
  config
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      const configKey = key as keyof Config;
      
      if (!(configKey in CONFIG_KEYS)) {
        console.log(chalk.red(`Unknown configuration key: ${key}`));
        process.exit(1);
      }
      
      const value = ConfigManager.get(configKey);
      
      if (value === undefined) {
        console.log(chalk.gray('(not set)'));
      } else if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // LIST COMMAND
  // ─────────────────────────────────────────────────────────────────
  config
    .command('list')
    .description('Display all configuration')
    .action(() => {
      const cfg = ConfigManager.load();
      
      console.log(chalk.bold('Linear CLI Configuration'));
      console.log(chalk.gray('Path: ' + ConfigManager.getConfigPath()));
      console.log('');
      
      for (const [key, meta] of Object.entries(CONFIG_KEYS)) {
        const value = cfg[key as keyof Config];
        const displayValue = value === undefined 
          ? chalk.gray('(not set)')
          : typeof value === 'object'
            ? chalk.yellow(JSON.stringify(value))
            : chalk.green(String(value));
        
        console.log(`${chalk.cyan(key)}: ${displayValue}`);
        console.log(chalk.gray(`  ${meta.description}`));
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // UNSET COMMAND
  // ─────────────────────────────────────────────────────────────────
  config
    .command('unset <key>')
    .description('Remove a configuration value')
    .action((key: string) => {
      const configKey = key as keyof Config;
      
      if (!(configKey in CONFIG_KEYS)) {
        console.log(chalk.red(`Unknown configuration key: ${key}`));
        process.exit(1);
      }
      
      ConfigManager.unset(configKey);
      console.log(chalk.green(`Removed ${chalk.cyan(key)}`));
    });

  // ─────────────────────────────────────────────────────────────────
  // RESET COMMAND
  // ─────────────────────────────────────────────────────────────────
  config
    .command('reset')
    .description('Reset all configuration to defaults')
    .action(() => {
      ConfigManager.reset();
      console.log(chalk.green('Configuration reset to defaults.'));
    });
}

