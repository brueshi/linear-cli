import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { ConfigManager } from '../lib/config.js';
import { resolveOrCreateLabels, parseLabels } from '../lib/agent/labels.js';
import { formatIdentifier } from '../utils/format.js';

export function registerQuickCommand(program: Command): void {
  program
    .command('quick <title>')
    .description('Rapid issue creation with minimal input')
    .option('-t, --team <team>', 'Team key (uses default if set)')
    .option('-p, --priority <priority>', 'Priority (1=Urgent, 2=High, 3=Medium, 4=Low)')
    .option('-d, --description <description>', 'Issue description')
    .option('--project <project>', 'Project name or ID')
    .option('--label <labels>', 'Labels (comma-separated, auto-creates if needed)')
    .option('-e, --estimate <points>', 'Story point estimate (Fibonacci: 1,2,3,5,8,13,21)')
    .option('-a, --assignee <email>', 'Assignee email (use "me" for yourself)')
    .option('--due <date>', 'Due date (YYYY-MM-DD format)')
    .option('--parent <id>', 'Parent issue ID for sub-issues')
    .action(async (title: string, options) => {
      try {
        const client = await getAuthenticatedClient();
        const config = ConfigManager.load();
        
        // Determine team
        let teamId: string | undefined;
        const teamKey = options.team || config.defaultTeam;
        
        // Get all teams
        const teams = await client.teams();
        
        if (teamKey) {
          // Look up team by key
          const team = teams.nodes.find(t => t.key.toUpperCase() === teamKey.toUpperCase());
          
          if (team) {
            teamId = team.id;
          } else {
            console.log(chalk.yellow(`Team "${teamKey}" not found.`));
          }
        }
        
        // If no team found, prompt for selection
        if (!teamId) {
          if (teams.nodes.length === 0) {
            console.log(chalk.red('No teams found. Please create a team in Linear first.'));
            process.exit(1);
          }
          
          if (teams.nodes.length === 1) {
            teamId = teams.nodes[0].id;
          } else {
            teamId = await select({
              message: 'Select a team:',
              choices: teams.nodes.map(t => ({
                name: `${t.key} - ${t.name}`,
                value: t.id,
              })),
            });
          }
        }
        
        // Determine project
        let projectId: string | undefined;
        
        if (options.project) {
          // Search for project by name or ID
          const projects = await client.projects({
            filter: {
              or: [
                { name: { containsIgnoreCase: options.project } },
                { id: { eq: options.project } },
              ],
            },
            first: 1,
          });
          
          if (projects.nodes.length > 0) {
            projectId = projects.nodes[0].id;
          } else {
            console.log(chalk.yellow(`Project "${options.project}" not found, skipping.`));
          }
        }
        
        // Determine priority
        const priority = options.priority 
          ? parseInt(options.priority, 10)
          : config.defaultPriority || 0;
        
        // Handle labels
        let labelIds: string[] | undefined;

        if (options.label) {
          const labelNames = parseLabels(options.label);

          if (labelNames.length > 0) {
            // Get existing labels for context
            const existingLabels = await client.issueLabels({ first: 100 });
            const labelContext = existingLabels.nodes.map(l => ({ id: l.id, name: l.name }));

            const result = await resolveOrCreateLabels(client, labelNames, labelContext, teamId);
            labelIds = result.labelIds;

            if (result.createdLabels.length > 0) {
              console.log(chalk.gray(`Created labels: ${result.createdLabels.join(', ')}`));
            }
          }
        }

        // Handle estimate
        const estimate = options.estimate ? parseFloat(options.estimate) : undefined;
        if (estimate !== undefined && estimate <= 0) {
          console.log(chalk.yellow('Estimate must be a positive number.'));
        }

        // Handle assignee
        let assigneeId: string | undefined;
        if (options.assignee) {
          if (options.assignee === 'me') {
            const viewer = await client.viewer;
            assigneeId = viewer.id;
          } else {
            const users = await client.users({
              filter: { email: { containsIgnoreCase: options.assignee } },
              first: 1,
            });
            if (users.nodes.length > 0) {
              assigneeId = users.nodes[0].id;
            } else {
              console.log(chalk.yellow(`User "${options.assignee}" not found, skipping assignment.`));
            }
          }
        }

        // Handle due date
        let dueDate: string | undefined;
        if (options.due) {
          const parsed = new Date(options.due);
          if (isNaN(parsed.getTime())) {
            console.log(chalk.yellow(`Invalid date format "${options.due}". Use YYYY-MM-DD.`));
          } else {
            dueDate = options.due;
          }
        }

        // Handle parent issue for sub-issues
        let parentId: string | undefined;
        if (options.parent) {
          // Try to find the parent issue
          const parentIssue = await findIssue(client, options.parent);
          if (parentIssue) {
            parentId = parentIssue.id;
          } else {
            console.log(chalk.yellow(`Parent issue "${options.parent}" not found, creating as standalone.`));
          }
        }

        // Create the issue
        const issuePayload = await client.createIssue({
          teamId,
          title: title.trim(),
          description: options.description?.trim() || undefined,
          priority: priority || undefined,
          projectId,
          labelIds,
          estimate: estimate && estimate > 0 ? estimate : undefined,
          assigneeId,
          dueDate,
          parentId,
        });
        
        const createdIssue = await issuePayload.issue;
        
        if (createdIssue) {
          console.log(
            chalk.green('Created ') + 
            formatIdentifier(createdIssue.identifier) + 
            ' ' + createdIssue.title
          );
          console.log(chalk.gray(createdIssue.url));
        } else {
          console.log(chalk.red('Failed to create issue.'));
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        console.log(chalk.red('Failed to create issue.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(1);
      }
    });
}

/**
 * Find an issue by identifier (e.g., "ENG-123") or ID
 */
async function findIssue(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  identifier: string
) {
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
