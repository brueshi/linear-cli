import { Command } from 'commander';
import { editor } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { findProject } from '../utils/find-issue.js';
import { formatDate, truncate } from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  projectUpdateToJson,
  ExitCodes,
  type ProjectUpdateJson,
} from '../utils/json-output.js';

/**
 * Health status colors
 */
const HEALTH_COLORS: Record<string, (text: string) => string> = {
  onTrack: chalk.green,
  atRisk: chalk.yellow,
  offTrack: chalk.red,
};

const HEALTH_LABELS: Record<string, string> = {
  onTrack: 'On Track',
  atRisk: 'At Risk',
  offTrack: 'Off Track',
};

/**
 * Register project update commands
 */
export function registerProjectUpdateCommands(program: Command): void {
  const update = program
    .command('project-update')
    .description('Manage project status updates');

  // ─────────────────────────────────────────────────────────────────
  // LIST COMMAND
  // ─────────────────────────────────────────────────────────────────
  update
    .command('list <project>')
    .description('List status updates for a project')
    .option('-l, --limit <number>', 'Maximum number of updates', '10')
    .option('--json', 'Output in JSON format')
    .action(async (projectName: string, options) => {
      try {
        const client = await getAuthenticatedClient();

        const project = await findProject(client, projectName);
        if (!project) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Project "${projectName}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Project "${projectName}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }

        // Fetch the full project to access projectUpdates
        const fullProject = await client.project(project.id);
        const updates = await fullProject.projectUpdates({
          first: parseInt(options.limit, 10),
        });

        if (isJsonMode()) {
          const updatesJson: ProjectUpdateJson[] = await Promise.all(
            updates.nodes.map(u => projectUpdateToJson(u))
          );
          outputJson({
            project: { id: project.id, name: project.name },
            updates: updatesJson,
            count: updatesJson.length,
          });
          return;
        }

        if (updates.nodes.length === 0) {
          console.log(chalk.yellow(`No status updates for "${project.name}".`));
          return;
        }

        console.log('');
        console.log(chalk.bold(`Status Updates for ${project.name}`));
        console.log(chalk.gray('─'.repeat(60)));

        for (const u of updates.nodes) {
          const user = await u.user;
          const healthFn = HEALTH_COLORS[u.health] || chalk.white;
          const healthLabel = HEALTH_LABELS[u.health] || u.health;
          const date = formatDate(u.createdAt);
          const author = user?.name || user?.email || 'Unknown';

          console.log('');
          console.log(`  ${healthFn(`[${healthLabel}]`)} ${chalk.gray(`by ${author} on ${date}`)}`);

          if (u.body) {
            const lines = u.body.split('\n').slice(0, 5);
            for (const line of lines) {
              console.log(`  ${line}`);
            }
            if (u.body.split('\n').length > 5) {
              console.log(chalk.gray('  ...'));
            }
          }
        }
        console.log('');
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch project updates.'));
        if (error instanceof Error) console.log(chalk.gray(error.message));
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // CREATE COMMAND
  // ─────────────────────────────────────────────────────────────────
  update
    .command('create <project>')
    .description('Create a status update for a project')
    .option('-b, --body <text>', 'Update body (markdown)')
    .option('-h, --health <status>', 'Health status: on-track, at-risk, off-track', 'onTrack')
    .option('-e, --editor', 'Open editor for body')
    .option('--json', 'Output in JSON format')
    .action(async (projectName: string, options) => {
      try {
        const client = await getAuthenticatedClient();

        const project = await findProject(client, projectName);
        if (!project) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Project "${projectName}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Project "${projectName}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }

        // Normalize health status
        const healthMap: Record<string, string> = {
          'on-track': 'onTrack',
          'ontrack': 'onTrack',
          'at-risk': 'atRisk',
          'atrisk': 'atRisk',
          'off-track': 'offTrack',
          'offtrack': 'offTrack',
        };
        const health = healthMap[options.health.toLowerCase()] || options.health;

        // Get body
        let body = options.body;
        if (!body && options.editor && !isJsonMode()) {
          body = await editor({
            message: 'Write your status update (save and close to continue):',
          });
        }

        if (!body || !body.trim()) {
          if (isJsonMode()) {
            outputJsonError('EMPTY_BODY', 'Update body is required');
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
          console.log(chalk.yellow('Update body is required. Use -b or -e.'));
          process.exit(ExitCodes.VALIDATION_ERROR);
        }

        const result = await client.createProjectUpdate({
          projectId: project.id,
          body: body.trim(),
          health,
        });

        const createdUpdate = await result.projectUpdate;

        if (createdUpdate) {
          if (isJsonMode()) {
            const updateJson = await projectUpdateToJson(createdUpdate);
            outputJson({ update: updateJson });
            return;
          }

          const healthFn = HEALTH_COLORS[health] || chalk.white;
          const healthLabel = HEALTH_LABELS[health] || health;
          console.log(chalk.green('Status update posted!'));
          console.log(`  ${chalk.cyan(project.name)} ${healthFn(`[${healthLabel}]`)}`);
        } else {
          if (isJsonMode()) {
            outputJsonError('CREATE_FAILED', 'Failed to create project update');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Failed to create project update.'));
          process.exit(ExitCodes.GENERAL_ERROR);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        if (isJsonMode()) {
          outputJsonError('CREATE_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to create project update.'));
        if (error instanceof Error) console.log(chalk.gray(error.message));
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });
}
