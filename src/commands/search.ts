import { Command } from 'commander';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { formatIdentifier, formatPriority, formatState, truncate, printListHeader } from '../utils/format.js';

/**
 * Register search commands
 */
export function registerSearchCommands(program: Command): void {
  program
    .command('search <query>')
    .description('Search for issues across the workspace')
    .option('-t, --team <key>', 'Filter by team key')
    .option('-s, --state <name>', 'Filter by state (e.g., "in progress", "done")')
    .option('-a, --assignee <email>', 'Filter by assignee (use "me" for yourself)')
    .option('-p, --project <name>', 'Filter by project name')
    .option('-l, --label <name>', 'Filter by label')
    .option('--limit <number>', 'Maximum results to return', '25')
    .option('--include-archived', 'Include archived issues')
    .action(async (query: string, options) => {
      try {
        const client = await getAuthenticatedClient();
        const limit = Math.min(parseInt(options.limit) || 25, 100);

        // Build filter object
        const filter: Record<string, unknown> = {};

        // Team filter
        if (options.team) {
          filter.team = { key: { eq: options.team.toUpperCase() } };
        }

        // State filter
        if (options.state) {
          filter.state = { name: { containsIgnoreCase: options.state } };
        }

        // Assignee filter
        if (options.assignee) {
          if (options.assignee === 'me') {
            const viewer = await client.viewer;
            filter.assignee = { id: { eq: viewer.id } };
          } else {
            filter.assignee = { email: { containsIgnoreCase: options.assignee } };
          }
        }

        // Project filter
        if (options.project) {
          filter.project = { name: { containsIgnoreCase: options.project } };
        }

        // Label filter
        if (options.label) {
          filter.labels = { some: { name: { containsIgnoreCase: options.label } } };
        }

        // Archived filter
        if (!options.includeArchived) {
          filter.archivedAt = { null: true };
        }

        console.log(chalk.gray(`Searching for "${query}"...`));
        console.log('');

        // Use issueSearch for full-text search
        const searchResult = await client.searchIssues(query, {
          first: limit,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          includeArchived: options.includeArchived || false,
        });

        const issues = searchResult.nodes;

        if (issues.length === 0) {
          console.log(chalk.yellow('No issues found matching your search.'));
          console.log('');
          console.log(chalk.gray('Tips:'));
          console.log(chalk.gray('  - Try broader search terms'));
          console.log(chalk.gray('  - Remove filters to expand results'));
          console.log(chalk.gray('  - Use --include-archived to search archived issues'));
          return;
        }

        console.log(chalk.green(`Found ${issues.length} issue${issues.length === 1 ? '' : 's'}:`));
        console.log('');

        printListHeader();

        for (const issue of issues) {
          const state = await issue.state;
          const assignee = await issue.assignee;

          const id = formatIdentifier(issue.identifier.padEnd(10));
          const title = truncate(issue.title, 50).padEnd(52);
          const stateStr = state ? formatState(state).padEnd(20) : chalk.gray('Unknown').padEnd(20);
          const assigneeStr = assignee ? (assignee.name || assignee.email) : chalk.gray('Unassigned');

          console.log(`${id} ${title} ${stateStr} ${assigneeStr}`);
        }

        if (searchResult.pageInfo.hasNextPage) {
          console.log('');
          console.log(chalk.gray(`Showing first ${limit} results. Use --limit to see more.`));
        }
      } catch (error) {
        if (error instanceof Error) {
          // Handle case where searchIssues might not be available
          if (error.message.includes('searchIssues') || error.message.includes('not a function')) {
            console.log(chalk.yellow('Full-text search not available. Falling back to filtered search...'));
            await fallbackSearch(query, options);
            return;
          }
          console.log(chalk.red(`Search failed: ${error.message}`));
        } else {
          console.log(chalk.red('Search failed with an unknown error.'));
        }
        process.exit(1);
      }
    });
}

/**
 * Fallback search using issue filtering when full-text search is unavailable
 */
async function fallbackSearch(query: string, options: Record<string, unknown>): Promise<void> {
  const client = await getAuthenticatedClient();
  const limit = Math.min(parseInt(options.limit as string) || 25, 100);

  // Build filter with title/description contains
  const filter: Record<string, unknown> = {
    or: [
      { title: { containsIgnoreCase: query } },
      { description: { containsIgnoreCase: query } },
    ],
  };

  // Add additional filters
  if (options.team) {
    filter.team = { key: { eq: (options.team as string).toUpperCase() } };
  }
  if (options.state) {
    filter.state = { name: { containsIgnoreCase: options.state as string } };
  }
  if (options.assignee) {
    if (options.assignee === 'me') {
      const viewer = await client.viewer;
      filter.assignee = { id: { eq: viewer.id } };
    } else {
      filter.assignee = { email: { containsIgnoreCase: options.assignee as string } };
    }
  }
  if (!options.includeArchived) {
    filter.archivedAt = { null: true };
  }

  const issues = await client.issues({
    filter,
    first: limit,
  });

  if (issues.nodes.length === 0) {
    console.log(chalk.yellow('No issues found matching your search.'));
    return;
  }

  console.log(chalk.green(`Found ${issues.nodes.length} issue${issues.nodes.length === 1 ? '' : 's'}:`));
  console.log('');

  printListHeader();

  for (const issue of issues.nodes) {
    const state = await issue.state;
    const assignee = await issue.assignee;

    const id = formatIdentifier(issue.identifier.padEnd(10));
    const title = truncate(issue.title, 50).padEnd(52);
    const stateStr = state ? formatState(state).padEnd(20) : chalk.gray('Unknown').padEnd(20);
    const assigneeStr = assignee ? (assignee.name || assignee.email) : chalk.gray('Unassigned');

    console.log(`${id} ${title} ${stateStr} ${assigneeStr}`);
  }
}
