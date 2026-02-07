import { LinearClient } from '@linear/sdk';
import chalk from 'chalk';
import { AuthManager } from './auth.js';
/**
 * Create a Linear client instance with the provided API key
 */
export function createLinearClient(apiKey) {
    return new LinearClient({ apiKey });
}
/**
 * Get an authenticated Linear client using stored credentials.
 * Exits the process if not authenticated.
 */
export async function getAuthenticatedClient() {
    const apiKey = await AuthManager.getApiKey();
    if (!apiKey) {
        console.log(chalk.red('Not authenticated.'));
        console.log('Run ' + chalk.cyan('linear auth login') + ' or set ' + chalk.cyan('LINEAR_API_KEY') + ' env var to get started.');
        process.exit(1);
    }
    return createLinearClient(apiKey);
}
