import { Command } from 'commander';
import { password } from '@inquirer/prompts';
import chalk from 'chalk';
import { AuthManager } from '../lib/auth.js';
import { createLinearClient } from '../lib/client.js';

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Manage Linear authentication');

  auth
    .command('login')
    .description('Store API key securely in keychain')
    .action(async () => {
      try {
        // Check for environment variable authentication
        if (AuthManager.isEnvAuth()) {
          console.log(chalk.green('Authenticated via environment variable LINEAR_API_KEY.'));
          console.log(chalk.gray('Keychain login is not needed when using env var authentication.'));
          return;
        }

        // Check if already authenticated
        if (await AuthManager.hasApiKey()) {
          console.log(chalk.yellow('You are already logged in.'));
          console.log('Run ' + chalk.cyan('linear auth logout') + ' first to switch accounts.');
          return;
        }

        // Prompt for API key (hidden input)
        const apiKey = await password({
          message: 'Enter your Linear API key:',
          mask: '*',
        });

        if (!apiKey || apiKey.trim() === '') {
          console.log(chalk.red('API key cannot be empty.'));
          process.exit(1);
        }

        // Validate the API key by making a test request
        console.log(chalk.gray('Validating API key...'));
        const client = createLinearClient(apiKey.trim());

        try {
          const viewer = await client.viewer;
          await AuthManager.saveApiKey(apiKey.trim());
          console.log(chalk.green('Successfully logged in as ' + chalk.bold(viewer.name || viewer.email)));
        } catch {
          console.log(chalk.red('Invalid API key. Please check your key and try again.'));
          console.log(chalk.gray('You can create an API key at: https://linear.app/settings/api'));
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          // User cancelled the prompt
          console.log(chalk.gray('\nLogin cancelled.'));
          return;
        }
        throw error;
      }
    });

  auth
    .command('logout')
    .description('Remove stored credentials')
    .action(async () => {
      if (AuthManager.isEnvAuth()) {
        console.log(chalk.yellow('Authentication is provided via LINEAR_API_KEY environment variable.'));
        console.log('Unset the variable to remove access: ' + chalk.cyan('unset LINEAR_API_KEY'));
        return;
      }

      const deleted = await AuthManager.deleteApiKey();

      if (deleted) {
        console.log(chalk.green('Successfully logged out.'));
      } else {
        console.log(chalk.yellow('No credentials found. You are not logged in.'));
      }
    });

  auth
    .command('status')
    .description('Display current authentication state')
    .action(async () => {
      const hasKey = await AuthManager.hasApiKey();

      if (!hasKey) {
        console.log(chalk.yellow('Not authenticated.'));
        console.log('Run ' + chalk.cyan('linear auth login') + ' or set ' + chalk.cyan('LINEAR_API_KEY') + ' env var to get started.');
        return;
      }

      // Validate the key and show user info
      const source = AuthManager.isEnvAuth() ? 'environment variable' : 'system keychain';
      console.log(chalk.gray('Checking authentication...'));

      try {
        const apiKey = await AuthManager.getApiKey();
        if (!apiKey) {
          console.log(chalk.red('Failed to retrieve API key.'));
          return;
        }

        const client = createLinearClient(apiKey);
        const viewer = await client.viewer;

        console.log(chalk.green('Authenticated') + chalk.gray(` (via ${source})`));
        console.log('  User:  ' + chalk.bold(viewer.name || 'Unknown'));
        console.log('  Email: ' + chalk.bold(viewer.email));

        // Show organization info if available
        const org = await viewer.organization;
        if (org) {
          console.log('  Org:   ' + chalk.bold(org.name));
        }
      } catch {
        console.log(chalk.red('API key is invalid or expired.') + chalk.gray(` (source: ${source})`));
        if (AuthManager.isEnvAuth()) {
          console.log('Check that your ' + chalk.cyan('LINEAR_API_KEY') + ' environment variable is correct.');
        } else {
          console.log('Run ' + chalk.cyan('linear auth logout') + ' then ' + chalk.cyan('linear auth login') + ' to re-authenticate.');
        }
      }
    });
}

