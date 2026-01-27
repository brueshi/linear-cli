import { Command } from 'commander';
import chalk from 'chalk';
import type { LinearClient, Issue } from '@linear/sdk';
import { getAuthenticatedClient } from '../lib/client.js';
import { formatIdentifier } from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  issueToJson,
  ExitCodes,
  type PrDescriptionJson,
} from '../utils/json-output.js';

/**
 * Find an issue by identifier (e.g., "ENG-123") or ID
 */
async function findIssue(
  client: LinearClient,
  identifier: string
): Promise<Issue | null> {
  const normalized = identifier.toUpperCase();
  const match = normalized.match(/^([A-Z]+)-(\d+)$/);

  if (match) {
    const [, teamKey, numberStr] = match;
    const issueNumber = parseInt(numberStr, 10);

    const issues = await client.issues({
      filter: {
        team: { key: { eq: teamKey } },
        number: { eq: issueNumber },
      },
      first: 1,
    });

    return issues.nodes[0] || null;
  }

  // Try as raw ID
  try {
    return await client.issue(identifier);
  } catch {
    return null;
  }
}

/**
 * Generate a PR title from an issue
 */
function generatePrTitle(issue: Issue): string {
  // Format: "ISSUE-123: Title"
  return `${issue.identifier}: ${issue.title}`;
}

/**
 * Generate a PR body/description from an issue
 */
async function generatePrBody(issue: Issue): Promise<string> {
  const lines: string[] = [];
  
  // Link to Linear issue
  lines.push(`## Linear Issue`);
  lines.push('');
  lines.push(`[${issue.identifier}: ${issue.title}](${issue.url})`);
  lines.push('');
  
  // Description
  if (issue.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(issue.description);
    lines.push('');
  }
  
  // Labels
  const labels = await issue.labels();
  if (labels.nodes.length > 0) {
    lines.push('## Labels');
    lines.push('');
    lines.push(labels.nodes.map(l => `\`${l.name}\``).join(', '));
    lines.push('');
  }
  
  // Priority
  if (issue.priority > 0) {
    const priorityLabels = ['', 'Urgent', 'High', 'Medium', 'Low'];
    lines.push(`**Priority:** ${priorityLabels[issue.priority]}`);
    lines.push('');
  }
  
  // Checklist
  lines.push('## Checklist');
  lines.push('');
  lines.push('- [ ] Code follows project style guidelines');
  lines.push('- [ ] Tests added/updated as needed');
  lines.push('- [ ] Documentation updated if necessary');
  lines.push('- [ ] Changes reviewed locally');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Register the PR command
 */
export function registerPrCommand(program: Command): void {
  program
    .command('pr <issue>')
    .description('Generate PR title and description from a Linear issue')
    .option('--json', 'Output in JSON format')
    .option('--title-only', 'Output only the PR title')
    .option('--body-only', 'Output only the PR body')
    .option('--copy', 'Copy PR description to clipboard')
    .addHelpText('after', `
Examples:
  $ linear pr ABC-123                    # Generate PR title and body
  $ linear pr ABC-123 --json             # JSON output for scripting
  $ linear pr ABC-123 --title-only       # Just the title
  $ linear pr ABC-123 --copy             # Copy to clipboard

This command generates a PR title and description based on the Linear issue.
The output is formatted for GitHub/GitLab PRs and includes:
- Link to the Linear issue
- Issue description
- Labels
- Priority
- Standard PR checklist
    `)
    .action(async (issueId: string, options) => {
      try {
        const client = await getAuthenticatedClient();
        const issue = await findIssue(client, issueId);

        if (!issue) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Issue "${issueId}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }

        const title = generatePrTitle(issue);
        const body = await generatePrBody(issue);

        if (isJsonMode()) {
          const issueJson = await issueToJson(issue);
          const prJson: PrDescriptionJson = {
            title,
            body,
            issue: issueJson,
          };
          outputJson(prJson);
          return;
        }

        if (options.titleOnly) {
          console.log(title);
          return;
        }

        if (options.bodyOnly) {
          console.log(body);
          return;
        }

        if (options.copy) {
          const fullContent = `${title}\n\n${body}`;
          const { execSync } = await import('child_process');
          try {
            execSync(`echo "${fullContent.replace(/"/g, '\\"')}" | pbcopy`);
            console.log(chalk.green('PR description copied to clipboard!'));
            console.log('');
            console.log(chalk.gray('Title:'));
            console.log(chalk.cyan(title));
          } catch {
            // Fallback: just print it
            console.log(chalk.yellow('Could not copy to clipboard. Here is the content:'));
            console.log('');
            console.log(title);
            console.log('');
            console.log(body);
          }
          return;
        }

        // Default: print both title and body
        console.log('');
        console.log(chalk.bold('PR Title:'));
        console.log(chalk.cyan(title));
        console.log('');
        console.log(chalk.bold('PR Body:'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(body);
        console.log(chalk.gray('─'.repeat(60)));
        console.log('');
        console.log(chalk.gray(`Issue: ${formatIdentifier(issue.identifier)} - ${issue.title}`));
        console.log(chalk.gray(`URL: ${issue.url}`));
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('PR_GENERATION_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to generate PR description.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });
}
