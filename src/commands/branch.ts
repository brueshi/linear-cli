import { Command } from 'commander';
import { select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { ConfigManager } from '../lib/config.js';
import {
  isGitRepo,
  getIssueFromCurrentBranch,
  generateBranchName,
  createBranch,
  branchExists,
  type BranchStyle,
} from '../utils/git.js';
import { formatIdentifier } from '../utils/format.js';

export function registerBranchCommand(program: Command): void {
  program
    .command('branch [issue]')
    .description('Generate and create git branch from issue')
    .option('-s, --style <style>', 'Branch style: feature, kebab, or plain')
    .option('--no-checkout', 'Create branch without switching to it')
    .option('--copy', 'Copy branch name to clipboard instead of creating')
    .action(async (issueArg: string | undefined, options) => {
      try {
        // Check if we're in a git repo
        if (!isGitRepo() && !options.copy) {
          console.log(chalk.red('Not in a git repository.'));
          console.log(chalk.gray('Use --copy to copy the branch name to clipboard instead.'));
          process.exit(1);
        }
        
        const client = await getAuthenticatedClient();
        const config = ConfigManager.load();
        
        // Determine issue identifier
        let issueId = issueArg;
        
        if (!issueId) {
          // Try to get from current branch
          issueId = getIssueFromCurrentBranch() || undefined;
          
          if (!issueId) {
            // Show recent issues to pick from
            console.log(chalk.gray('No issue specified. Showing recent issues...'));
            
            const issues = await client.issues({
              first: 10,
              orderBy: client.constructor.name ? undefined : undefined,
            });
            
            if (issues.nodes.length === 0) {
              console.log(chalk.yellow('No issues found.'));
              process.exit(1);
            }
            
            const selected = await select({
              message: 'Select an issue:',
              choices: issues.nodes.map(i => ({
                name: `${i.identifier} - ${i.title.slice(0, 60)}`,
                value: i.identifier,
              })),
            });
            
            issueId = selected;
          }
        }
        
        // Fetch the issue
        const normalizedId = issueId.toUpperCase();
        const match = normalizedId.match(/^([A-Z]+)-(\d+)$/);
        
        if (!match) {
          console.log(chalk.red(`Invalid issue identifier: ${issueId}`));
          console.log(chalk.gray('Expected format: TEAM-123'));
          process.exit(1);
        }
        
        const [, teamKey, numberStr] = match;
        const issueNumber = parseInt(numberStr, 10);
        
        const issues = await client.issues({
          filter: {
            team: { key: { eq: teamKey } },
            number: { eq: issueNumber },
          },
          first: 1,
        });
        
        const issue = issues.nodes[0];
        
        if (!issue) {
          console.log(chalk.red(`Issue "${issueId}" not found.`));
          process.exit(1);
        }
        
        // Generate branch name
        const style = (options.style || config.branchStyle || 'feature') as BranchStyle;
        const branchName = generateBranchName(issue.identifier, issue.title, style);
        
        if (options.copy) {
          // Copy to clipboard
          const { execSync } = await import('child_process');
          try {
            execSync(`echo "${branchName}" | pbcopy`);
            console.log(chalk.green('Copied to clipboard: ') + chalk.cyan(branchName));
          } catch {
            // Fallback: just print it
            console.log(chalk.cyan(branchName));
          }
          return;
        }
        
        // Check if branch exists
        if (branchExists(branchName)) {
          console.log(chalk.yellow(`Branch "${branchName}" already exists.`));
          
          const shouldCheckout = await confirm({
            message: 'Switch to existing branch?',
            default: true,
          });
          
          if (shouldCheckout) {
            const { execSync } = await import('child_process');
            execSync(`git checkout "${branchName}"`, { stdio: 'inherit' });
          }
          return;
        }
        
        // Create the branch
        console.log(
          chalk.gray('Creating branch for ') + 
          formatIdentifier(issue.identifier) + 
          chalk.gray('...')
        );
        
        createBranch(branchName, options.checkout !== false);
        
        if (options.checkout !== false) {
          console.log(chalk.green('Switched to branch: ') + chalk.cyan(branchName));
        } else {
          console.log(chalk.green('Created branch: ') + chalk.cyan(branchName));
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        console.log(chalk.red('Failed to create branch.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(1);
      }
    });
}

