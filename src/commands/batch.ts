import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { getAuthenticatedClient } from '../lib/client.js';
import { formatIdentifier, formatState, truncate } from '../utils/format.js';

/**
 * Register batch commands for bulk operations
 */
export function registerBatchCommands(program: Command): void {
  const batch = program
    .command('batch')
    .description('Bulk operations on issues');

  // Batch update
  batch
    .command('update <issues...>')
    .description('Update multiple issues at once')
    .option('-s, --status <name>', 'Set status/state')
    .option('-p, --priority <0-4>', 'Set priority')
    .option('-a, --assignee <email>', 'Set assignee (use "me" for yourself, "none" to unassign)')
    .option('--add-label <labels>', 'Add labels (comma-separated)')
    .option('--remove-label <labels>', 'Remove labels (comma-separated)')
    .option('--project <name>', 'Move to project')
    .option('--file <path>', 'Read issue IDs from file (one per line)')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (issues: string[], options) => {
      try {
        const client = await getAuthenticatedClient();

        // Collect issue IDs from arguments and file
        let issueIds = [...issues];
        if (options.file) {
          const fileContent = fs.readFileSync(options.file, 'utf-8');
          const fileIds = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
          issueIds = [...issueIds, ...fileIds];
        }

        // Remove duplicates
        issueIds = [...new Set(issueIds)];

        if (issueIds.length === 0) {
          console.log(chalk.yellow('No issue IDs provided.'));
          return;
        }

        // Build update object
        const updateFields: string[] = [];
        if (options.status) updateFields.push(`status: ${options.status}`);
        if (options.priority) updateFields.push(`priority: ${options.priority}`);
        if (options.assignee) updateFields.push(`assignee: ${options.assignee}`);
        if (options.addLabel) updateFields.push(`add labels: ${options.addLabel}`);
        if (options.removeLabel) updateFields.push(`remove labels: ${options.removeLabel}`);
        if (options.project) updateFields.push(`project: ${options.project}`);

        if (updateFields.length === 0) {
          console.log(chalk.yellow('No update options specified. Use --help for available options.'));
          return;
        }

        console.log(chalk.bold(`\nBatch Update: ${issueIds.length} issue${issueIds.length === 1 ? '' : 's'}`));
        console.log(chalk.gray('Updates to apply:'));
        for (const field of updateFields) {
          console.log(chalk.gray(`  - ${field}`));
        }
        console.log('');

        // Process each issue
        let succeeded = 0;
        let failed = 0;
        const errors: { id: string; error: string }[] = [];

        // Get viewer for "me" assignee
        const viewer = options.assignee === 'me' ? await client.viewer : null;

        // Find project if specified
        let projectId: string | undefined;
        if (options.project) {
          const projects = await client.projects({
            filter: { name: { containsIgnoreCase: options.project } },
            first: 1,
          });
          if (projects.nodes.length === 0) {
            console.log(chalk.red(`Project "${options.project}" not found.`));
            process.exit(1);
          }
          projectId = projects.nodes[0].id;
        }

        for (const issueId of issueIds) {
          try {
            process.stdout.write(chalk.gray(`Updating ${issueId}...`));

            const issue = await findIssue(client, issueId);
            if (!issue) {
              throw new Error('Issue not found');
            }

            const updateData: Record<string, unknown> = {};

            // Handle status
            if (options.status) {
              const team = await issue.team;
              if (!team) {
                throw new Error('Issue has no team');
              }
              const states = await team.states();
              const state = states.nodes.find(s =>
                s.name.toLowerCase().includes(options.status.toLowerCase())
              );
              if (state) {
                updateData.stateId = state.id;
              } else {
                throw new Error(`State "${options.status}" not found`);
              }
            }

            // Handle priority
            if (options.priority) {
              const priority = parseInt(options.priority);
              if (priority < 0 || priority > 4) {
                throw new Error('Priority must be 0-4');
              }
              updateData.priority = priority;
            }

            // Handle assignee
            if (options.assignee) {
              if (options.assignee === 'me') {
                updateData.assigneeId = viewer!.id;
              } else if (options.assignee === 'none') {
                updateData.assigneeId = null;
              } else {
                const users = await client.users({
                  filter: { email: { containsIgnoreCase: options.assignee } },
                  first: 1,
                });
                if (users.nodes.length === 0) {
                  throw new Error(`User "${options.assignee}" not found`);
                }
                updateData.assigneeId = users.nodes[0].id;
              }
            }

            // Handle labels
            if (options.addLabel || options.removeLabel) {
              const currentLabels = await issue.labels();
              let labelIds = currentLabels.nodes.map(l => l.id);

              if (options.addLabel) {
                const team = await issue.team;
                if (!team) {
                  throw new Error('Issue has no team');
                }
                const teamLabels = await client.issueLabels({
                  filter: { team: { id: { eq: team.id } } },
                  first: 100,
                });

                const labelsToAdd = options.addLabel.split(',').map((l: string) => l.trim().toLowerCase());
                for (const labelName of labelsToAdd) {
                  const label = teamLabels.nodes.find(l =>
                    l.name.toLowerCase() === labelName
                  );
                  if (label && !labelIds.includes(label.id)) {
                    labelIds.push(label.id);
                  }
                }
              }

              if (options.removeLabel) {
                const labelsToRemove = options.removeLabel.split(',').map((l: string) => l.trim().toLowerCase());
                const currentLabelNames = currentLabels.nodes.map(l => l.name.toLowerCase());
                labelIds = labelIds.filter((id, index) =>
                  !labelsToRemove.includes(currentLabelNames[index])
                );
              }

              updateData.labelIds = labelIds;
            }

            // Handle project
            if (projectId) {
              updateData.projectId = projectId;
            }

            // Apply update
            await issue.update(updateData);

            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            console.log(chalk.green(`${formatIdentifier(issue.identifier)} updated`));
            succeeded++;

          } catch (error) {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(chalk.red(`${issueId} failed: ${errorMsg}`));
            errors.push({ id: issueId, error: errorMsg });
            failed++;
          }
        }

        // Summary
        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(chalk.green(`  ${succeeded} succeeded`));
        if (failed > 0) {
          console.log(chalk.red(`  ${failed} failed`));
        }

      } catch (error) {
        handleError(error);
      }
    });

  // Batch close
  batch
    .command('close <issues...>')
    .description('Close multiple issues')
    .option('--file <path>', 'Read issue IDs from file')
    .option('--state <name>', 'Completion state name (default: "Done")')
    .action(async (issues: string[], options) => {
      try {
        const client = await getAuthenticatedClient();

        let issueIds = [...issues];
        if (options.file) {
          const fileContent = fs.readFileSync(options.file, 'utf-8');
          const fileIds = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
          issueIds = [...issueIds, ...fileIds];
        }

        issueIds = [...new Set(issueIds)];
        const stateName = options.state || 'Done';

        console.log(chalk.bold(`\nClosing ${issueIds.length} issue${issueIds.length === 1 ? '' : 's'}...`));
        console.log('');

        let succeeded = 0;
        let failed = 0;

        for (const issueId of issueIds) {
          try {
            const issue = await findIssue(client, issueId);
            if (!issue) {
              throw new Error('Issue not found');
            }

            const team = await issue.team;
            if (!team) {
              throw new Error('Issue has no team');
            }
            const states = await team.states();
            const completedState = states.nodes.find(s =>
              s.type === 'completed' &&
              s.name.toLowerCase().includes(stateName.toLowerCase())
            ) || states.nodes.find(s => s.type === 'completed');

            if (!completedState) {
              throw new Error('No completed state found');
            }

            await issue.update({ stateId: completedState.id });
            console.log(chalk.green(`${formatIdentifier(issue.identifier)} closed`));
            succeeded++;

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(chalk.red(`${issueId} failed: ${errorMsg}`));
            failed++;
          }
        }

        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(chalk.green(`  ${succeeded} closed`));
        if (failed > 0) {
          console.log(chalk.red(`  ${failed} failed`));
        }

      } catch (error) {
        handleError(error);
      }
    });

  // Batch assign
  batch
    .command('assign <issues...>')
    .description('Assign multiple issues to a user')
    .option('--to <email>', 'Assignee email (use "me" for yourself)')
    .option('--file <path>', 'Read issue IDs from file')
    .action(async (issues: string[], options) => {
      try {
        if (!options.to) {
          console.log(chalk.yellow('Please specify --to <email> or --to me'));
          return;
        }

        const client = await getAuthenticatedClient();

        let issueIds = [...issues];
        if (options.file) {
          const fileContent = fs.readFileSync(options.file, 'utf-8');
          const fileIds = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
          issueIds = [...issueIds, ...fileIds];
        }

        issueIds = [...new Set(issueIds)];

        // Resolve assignee
        let assigneeId: string;
        let assigneeName: string;
        if (options.to === 'me') {
          const viewer = await client.viewer;
          assigneeId = viewer.id;
          assigneeName = viewer.name || viewer.email;
        } else {
          const users = await client.users({
            filter: { email: { containsIgnoreCase: options.to } },
            first: 1,
          });
          if (users.nodes.length === 0) {
            console.log(chalk.red(`User "${options.to}" not found.`));
            process.exit(1);
          }
          assigneeId = users.nodes[0].id;
          assigneeName = users.nodes[0].name || users.nodes[0].email;
        }

        console.log(chalk.bold(`\nAssigning ${issueIds.length} issue${issueIds.length === 1 ? '' : 's'} to ${assigneeName}...`));
        console.log('');

        let succeeded = 0;
        let failed = 0;

        for (const issueId of issueIds) {
          try {
            const issue = await findIssue(client, issueId);
            if (!issue) {
              throw new Error('Issue not found');
            }

            await issue.update({ assigneeId });
            console.log(chalk.green(`${formatIdentifier(issue.identifier)} assigned`));
            succeeded++;

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(chalk.red(`${issueId} failed: ${errorMsg}`));
            failed++;
          }
        }

        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(chalk.green(`  ${succeeded} assigned`));
        if (failed > 0) {
          console.log(chalk.red(`  ${failed} failed`));
        }

      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Find an issue by identifier or ID
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

  try {
    return await client.issue(identifier);
  } catch {
    return null;
  }
}

/**
 * Handle errors
 */
function handleError(error: unknown): never {
  if (error instanceof Error) {
    console.log(chalk.red(`Error: ${error.message}`));
  } else {
    console.log(chalk.red('An unknown error occurred.'));
  }
  process.exit(1);
}
