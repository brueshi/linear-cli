import { Command } from 'commander';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { formatIdentifier, formatPriority, formatState, truncate, formatDate } from '../utils/format.js';

/**
 * Register the 'me' command for personal dashboard
 */
export function registerMeCommand(program: Command): void {
  program
    .command('me')
    .description('View your personal dashboard - assigned issues, activity, and more')
    .option('--assigned', 'Show only issues assigned to you')
    .option('--created', 'Show only issues you created')
    .option('--due', 'Show only issues with upcoming due dates')
    .option('--limit <number>', 'Maximum issues per section', '10')
    .action(async (options) => {
      try {
        const client = await getAuthenticatedClient();
        const viewer = await client.viewer;
        const limit = parseInt(options.limit) || 10;

        // Header
        console.log(chalk.bold.cyan(`\n  ${viewer.name || viewer.email}`));
        console.log(chalk.gray(`  ${viewer.email}`));
        console.log('');

        // Determine what sections to show
        const showAll = !options.assigned && !options.created && !options.due;

        // Assigned Issues
        if (showAll || options.assigned) {
          await showAssignedIssues(client, viewer.id, limit);
        }

        // Created Issues
        if (options.created) {
          await showCreatedIssues(client, viewer.id, limit);
        }

        // Due Soon
        if (showAll || options.due) {
          await showDueSoon(client, viewer.id, limit);
        }

        // Summary stats (only in full view)
        if (showAll) {
          await showSummaryStats(client, viewer.id);
        }

      } catch (error) {
        if (error instanceof Error) {
          console.log(chalk.red(`Error: ${error.message}`));
        } else {
          console.log(chalk.red('An unknown error occurred.'));
        }
        process.exit(1);
      }
    });
}

/**
 * Show issues assigned to the user grouped by state
 */
async function showAssignedIssues(client: Awaited<ReturnType<typeof getAuthenticatedClient>>, userId: string, limit: number): Promise<void> {
  console.log(chalk.bold('  Assigned to You'));
  console.log(chalk.gray('  ' + '-'.repeat(50)));

  // Get active issues (not completed/cancelled)
  const activeIssues = await client.issues({
    filter: {
      assignee: { id: { eq: userId } },
      state: {
        type: { nin: ['completed', 'canceled'] },
      },
    },
    first: limit * 2, // Fetch more to allow grouping
    orderBy: { updatedAt: 'descending' } as unknown as undefined,
  });

  if (activeIssues.nodes.length === 0) {
    console.log(chalk.gray('  No active issues assigned to you.'));
    console.log('');
    return;
  }

  // Group by state type
  const byState: Record<string, typeof activeIssues.nodes> = {
    started: [],
    unstarted: [],
    backlog: [],
  };

  for (const issue of activeIssues.nodes) {
    const state = await issue.state;
    if (state) {
      const type = state.type || 'backlog';
      if (!byState[type]) byState[type] = [];
      byState[type].push(issue);
    }
  }

  // Show in progress first
  if (byState.started.length > 0) {
    console.log(chalk.yellow('\n  In Progress:'));
    for (const issue of byState.started.slice(0, limit)) {
      await printIssueLine(issue);
    }
  }

  // Then todo/unstarted
  if (byState.unstarted.length > 0) {
    console.log(chalk.blue('\n  Todo:'));
    for (const issue of byState.unstarted.slice(0, limit)) {
      await printIssueLine(issue);
    }
  }

  // Then backlog
  if (byState.backlog.length > 0) {
    console.log(chalk.gray('\n  Backlog:'));
    for (const issue of byState.backlog.slice(0, Math.min(5, limit))) {
      await printIssueLine(issue);
    }
  }

  console.log('');
}

/**
 * Show issues created by the user
 */
async function showCreatedIssues(client: Awaited<ReturnType<typeof getAuthenticatedClient>>, userId: string, limit: number): Promise<void> {
  console.log(chalk.bold('  Created by You'));
  console.log(chalk.gray('  ' + '-'.repeat(50)));

  const createdIssues = await client.issues({
    filter: {
      creator: { id: { eq: userId } },
    },
    first: limit,
    orderBy: { createdAt: 'descending' } as unknown as undefined,
  });

  if (createdIssues.nodes.length === 0) {
    console.log(chalk.gray('  No issues created by you.'));
    console.log('');
    return;
  }

  for (const issue of createdIssues.nodes) {
    await printIssueLine(issue);
  }

  console.log('');
}

/**
 * Show issues with upcoming due dates
 */
async function showDueSoon(client: Awaited<ReturnType<typeof getAuthenticatedClient>>, userId: string, limit: number): Promise<void> {
  console.log(chalk.bold('  Due Soon'));
  console.log(chalk.gray('  ' + '-'.repeat(50)));

  // Get issues due in the next 14 days
  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const dueIssues = await client.issues({
    filter: {
      assignee: { id: { eq: userId } },
      dueDate: {
        gte: now.toISOString().split('T')[0],
        lte: twoWeeksFromNow.toISOString().split('T')[0],
      },
      state: {
        type: { nin: ['completed', 'canceled'] },
      },
    },
    first: limit,
    orderBy: { dueDate: 'ascending' } as unknown as undefined,
  });

  if (dueIssues.nodes.length === 0) {
    console.log(chalk.gray('  No issues due in the next 2 weeks.'));
    console.log('');
    return;
  }

  for (const issue of dueIssues.nodes) {
    const dueDate = issue.dueDate ? new Date(issue.dueDate) : null;
    const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    let dueStr = '';
    if (daysUntilDue !== null) {
      if (daysUntilDue < 0) {
        dueStr = chalk.red(`(${Math.abs(daysUntilDue)}d overdue)`);
      } else if (daysUntilDue === 0) {
        dueStr = chalk.red('(due today)');
      } else if (daysUntilDue === 1) {
        dueStr = chalk.yellow('(due tomorrow)');
      } else if (daysUntilDue <= 3) {
        dueStr = chalk.yellow(`(${daysUntilDue}d)`);
      } else {
        dueStr = chalk.gray(`(${daysUntilDue}d)`);
      }
    }

    console.log(
      `  ${formatIdentifier(issue.identifier.padEnd(10))} ${truncate(issue.title, 40).padEnd(42)} ${dueStr}`
    );
  }

  console.log('');
}

/**
 * Show summary statistics
 */
async function showSummaryStats(client: Awaited<ReturnType<typeof getAuthenticatedClient>>, userId: string): Promise<void> {
  console.log(chalk.bold('  Summary'));
  console.log(chalk.gray('  ' + '-'.repeat(50)));

  // Count active issues
  const activeCount = await client.issues({
    filter: {
      assignee: { id: { eq: userId } },
      state: { type: { nin: ['completed', 'canceled'] } },
    },
    first: 1,
  });

  // Count completed this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const completedThisWeek = await client.issues({
    filter: {
      assignee: { id: { eq: userId } },
      completedAt: { gte: weekAgo.toISOString() },
    },
    first: 100,
  });

  // Count high priority
  const highPriority = await client.issues({
    filter: {
      assignee: { id: { eq: userId } },
      priority: { in: [1, 2] }, // Urgent and High
      state: { type: { nin: ['completed', 'canceled'] } },
    },
    first: 1,
  });

  console.log(`  ${chalk.cyan('Active issues:')}     ${activeCount.nodes.length > 0 ? '50+' : '0'}`);
  console.log(`  ${chalk.green('Completed (7d):')}   ${completedThisWeek.nodes.length}`);
  console.log(`  ${chalk.yellow('High priority:')}    ${highPriority.nodes.length > 0 ? '1+' : '0'}`);
  console.log('');
}

/**
 * Print a single issue line
 */
async function printIssueLine(issue: { identifier: string; title: string; priority: number; state: unknown }): Promise<void> {
  const priority = formatPriority(issue.priority);
  console.log(
    `  ${formatIdentifier(issue.identifier.padEnd(10))} ${priority.padEnd(12)} ${truncate(issue.title, 45)}`
  );
}
