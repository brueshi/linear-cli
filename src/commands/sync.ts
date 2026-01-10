import { Command } from 'commander';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { ContextEngine } from '../lib/agent/context-engine.js';

/**
 * Register sync command for cache management
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Refresh workspace cache and verify connection')
    .option('-v, --verbose', 'Show detailed cache information')
    .action(async (options) => {
      try {
        const client = await getAuthenticatedClient();

        console.log(chalk.gray('Syncing workspace data...'));
        console.log('');

        // Create context engine and force refresh
        const contextEngine = new ContextEngine(client);
        contextEngine.invalidateCache();

        const startTime = Date.now();
        const context = await contextEngine.fetchContext();
        const elapsed = Date.now() - startTime;

        console.log(chalk.green('Workspace synced successfully!'));
        console.log('');

        // Show summary
        console.log(chalk.bold('Workspace Summary:'));
        console.log(chalk.gray('-'.repeat(40)));
        console.log(`  ${chalk.cyan('User:')}      ${context.user.name || context.user.email}`);
        console.log(`  ${chalk.cyan('Teams:')}     ${context.teams.length}`);
        console.log(`  ${chalk.cyan('Projects:')}  ${context.projects.length}`);
        console.log(`  ${chalk.cyan('Labels:')}    ${context.labels.length}`);
        console.log(`  ${chalk.cyan('States:')}    ${context.states.length}`);
        console.log('');
        console.log(chalk.gray(`Synced in ${elapsed}ms`));

        if (options.verbose) {
          console.log('');
          console.log(chalk.bold('Teams:'));
          for (const team of context.teams) {
            console.log(`  ${chalk.cyan(team.key.padEnd(6))} ${team.name}`);
          }

          console.log('');
          console.log(chalk.bold('Projects:'));
          for (const project of context.projects.slice(0, 10)) {
            console.log(`  ${chalk.gray('-')} ${project.name}`);
          }
          if (context.projects.length > 10) {
            console.log(chalk.gray(`  ... and ${context.projects.length - 10} more`));
          }

          console.log('');
          console.log(chalk.bold('Recent Issues:'));
          for (const issue of context.recentIssues.slice(0, 5)) {
            console.log(`  ${chalk.cyan(issue.teamKey.padEnd(6))} ${issue.title.slice(0, 50)}`);
          }
        }

      } catch (error) {
        if (error instanceof Error) {
          console.log(chalk.red(`Sync failed: ${error.message}`));
        } else {
          console.log(chalk.red('Sync failed with an unknown error.'));
        }
        process.exit(1);
      }
    });
}
