import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { getAuthenticatedClient } from '../lib/client.js';
import { findIssueByIdentifier } from '../utils/find-issue.js';
import { formatIdentifier, formatState, truncate } from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  ExitCodes,
} from '../utils/json-output.js';

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
    .option('--cycle <number>', 'Add to cycle number')
    .option('--file <path>', 'Read issue IDs from file (one per line)')
    .option('-y, --yes', 'Skip confirmation')
    .option('--json', 'Output in JSON format')
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
          if (isJsonMode()) {
            outputJsonError('NO_INPUT', 'No issue IDs provided');
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
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
        if (options.cycle) updateFields.push(`cycle: ${options.cycle}`);

        if (updateFields.length === 0) {
          if (isJsonMode()) {
            outputJsonError('NO_UPDATES', 'No update options specified');
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
          console.log(chalk.yellow('No update options specified. Use --help for available options.'));
          return;
        }

        if (!isJsonMode()) {
          console.log(chalk.bold(`\nBatch Update: ${issueIds.length} issue${issueIds.length === 1 ? '' : 's'}`));
          console.log(chalk.gray('Updates to apply:'));
          for (const field of updateFields) {
            console.log(chalk.gray(`  - ${field}`));
          }
          console.log('');
        }

        // Process each issue
        let succeeded = 0;
        let failed = 0;
        const errors: { id: string; error: string }[] = [];
        const results: { id: string; identifier: string; success: boolean; error?: string }[] = [];

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
            if (isJsonMode()) {
              outputJsonError('NOT_FOUND', `Project "${options.project}" not found`);
              process.exit(ExitCodes.NOT_FOUND);
            }
            console.log(chalk.red(`Project "${options.project}" not found.`));
            process.exit(1);
          }
          projectId = projects.nodes[0].id;
        }

        for (const issueId of issueIds) {
          try {
            if (!isJsonMode()) {
              process.stdout.write(chalk.gray(`Updating ${issueId}...`));
            }

            const issue = await findIssueByIdentifier(client, issueId);
            if (!issue) {
              throw new Error('Issue not found');
            }

            const updateData: Record<string, unknown> = {};

            // Handle status
            if (options.status) {
              const team = await issue.team;
              if (!team) throw new Error('Issue has no team');
              const states = await team.states();
              const state = states.nodes.find(s =>
                s.name.toLowerCase().includes(options.status.toLowerCase())
              );
              if (state) {
                updateData.stateId = state.id;
              } else {
                throw new Error(`State "${options.status}" not found. Available: ${states.nodes.map(s => s.name).join(', ')}`);
              }
            }

            // Handle priority
            if (options.priority) {
              const priority = parseInt(options.priority);
              if (priority < 0 || priority > 4) throw new Error('Priority must be 0-4');
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
                if (users.nodes.length === 0) throw new Error(`User "${options.assignee}" not found`);
                updateData.assigneeId = users.nodes[0].id;
              }
            }

            // Handle labels
            if (options.addLabel || options.removeLabel) {
              const currentLabels = await issue.labels();
              let labelIds = currentLabels.nodes.map(l => l.id);

              if (options.addLabel) {
                const team = await issue.team;
                if (!team) throw new Error('Issue has no team');
                const teamLabels = await client.issueLabels({
                  filter: { team: { id: { eq: team.id } } },
                  first: 100,
                });

                const labelsToAdd = options.addLabel.split(',').map((l: string) => l.trim().toLowerCase());
                for (const labelName of labelsToAdd) {
                  const label = teamLabels.nodes.find(l => l.name.toLowerCase() === labelName);
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

            if (!isJsonMode()) {
              process.stdout.clearLine(0);
              process.stdout.cursorTo(0);
              console.log(chalk.green(`${formatIdentifier(issue.identifier)} updated`));
            }
            results.push({ id: issue.id, identifier: issue.identifier, success: true });
            succeeded++;

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            if (!isJsonMode()) {
              process.stdout.clearLine(0);
              process.stdout.cursorTo(0);
              console.log(chalk.red(`${issueId} failed: ${errorMsg}`));
            }
            errors.push({ id: issueId, error: errorMsg });
            results.push({ id: issueId, identifier: issueId, success: false, error: errorMsg });
            failed++;
          }
        }

        if (isJsonMode()) {
          outputJson({ results, succeeded, failed, total: issueIds.length });
          return;
        }

        // Summary
        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(chalk.green(`  ${succeeded} succeeded`));
        if (failed > 0) {
          console.log(chalk.red(`  ${failed} failed`));
        }

      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('BATCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        handleError(error);
      }
    });

  // Batch close
  batch
    .command('close <issues...>')
    .description('Close multiple issues')
    .option('--file <path>', 'Read issue IDs from file')
    .option('--state <name>', 'Completion state name (default: "Done")')
    .option('--json', 'Output in JSON format')
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

        if (!isJsonMode()) {
          console.log(chalk.bold(`\nClosing ${issueIds.length} issue${issueIds.length === 1 ? '' : 's'}...`));
          console.log('');
        }

        let succeeded = 0;
        let failed = 0;
        const results: { id: string; identifier: string; success: boolean; error?: string }[] = [];

        for (const issueId of issueIds) {
          try {
            const issue = await findIssueByIdentifier(client, issueId);
            if (!issue) throw new Error('Issue not found');

            const team = await issue.team;
            if (!team) throw new Error('Issue has no team');
            const states = await team.states();
            const completedState = states.nodes.find(s =>
              s.type === 'completed' &&
              s.name.toLowerCase().includes(stateName.toLowerCase())
            ) || states.nodes.find(s => s.type === 'completed');

            if (!completedState) throw new Error('No completed state found');

            await issue.update({ stateId: completedState.id });
            if (!isJsonMode()) {
              console.log(chalk.green(`${formatIdentifier(issue.identifier)} closed`));
            }
            results.push({ id: issue.id, identifier: issue.identifier, success: true });
            succeeded++;

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            if (!isJsonMode()) {
              console.log(chalk.red(`${issueId} failed: ${errorMsg}`));
            }
            results.push({ id: issueId, identifier: issueId, success: false, error: errorMsg });
            failed++;
          }
        }

        if (isJsonMode()) {
          outputJson({ results, succeeded, failed, total: issueIds.length });
          return;
        }

        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(chalk.green(`  ${succeeded} closed`));
        if (failed > 0) {
          console.log(chalk.red(`  ${failed} failed`));
        }

      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('BATCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        handleError(error);
      }
    });

  // Batch assign
  batch
    .command('assign <issues...>')
    .description('Assign multiple issues to a user')
    .option('--to <email>', 'Assignee email (use "me" for yourself)')
    .option('--file <path>', 'Read issue IDs from file')
    .option('--json', 'Output in JSON format')
    .action(async (issues: string[], options) => {
      try {
        if (!options.to) {
          if (isJsonMode()) {
            outputJsonError('VALIDATION_ERROR', 'Please specify --to <email> or --to me');
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
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
            if (isJsonMode()) {
              outputJsonError('NOT_FOUND', `User "${options.to}" not found`);
              process.exit(ExitCodes.NOT_FOUND);
            }
            console.log(chalk.red(`User "${options.to}" not found.`));
            process.exit(1);
          }
          assigneeId = users.nodes[0].id;
          assigneeName = users.nodes[0].name || users.nodes[0].email;
        }

        if (!isJsonMode()) {
          console.log(chalk.bold(`\nAssigning ${issueIds.length} issue${issueIds.length === 1 ? '' : 's'} to ${assigneeName}...`));
          console.log('');
        }

        let succeeded = 0;
        let failed = 0;
        const results: { id: string; identifier: string; success: boolean; error?: string }[] = [];

        for (const issueId of issueIds) {
          try {
            const issue = await findIssueByIdentifier(client, issueId);
            if (!issue) throw new Error('Issue not found');

            await issue.update({ assigneeId });
            if (!isJsonMode()) {
              console.log(chalk.green(`${formatIdentifier(issue.identifier)} assigned`));
            }
            results.push({ id: issue.id, identifier: issue.identifier, success: true });
            succeeded++;

          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            if (!isJsonMode()) {
              console.log(chalk.red(`${issueId} failed: ${errorMsg}`));
            }
            results.push({ id: issueId, identifier: issueId, success: false, error: errorMsg });
            failed++;
          }
        }

        if (isJsonMode()) {
          outputJson({ results, assignee: { id: assigneeId, name: assigneeName }, succeeded, failed, total: issueIds.length });
          return;
        }

        console.log('');
        console.log(chalk.bold('Summary:'));
        console.log(chalk.green(`  ${succeeded} assigned`));
        if (failed > 0) {
          console.log(chalk.red(`  ${failed} failed`));
        }

      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('BATCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        handleError(error);
      }
    });
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
