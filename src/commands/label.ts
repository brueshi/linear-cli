import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  labelToJson,
  ExitCodes,
  type LabelJson,
} from '../utils/json-output.js';

/**
 * Register label management commands
 */
export function registerLabelCommands(program: Command): void {
  const label = program
    .command('label')
    .description('Manage Linear labels');

  // ─────────────────────────────────────────────────────────────────
  // LIST COMMAND
  // ─────────────────────────────────────────────────────────────────
  label
    .command('list')
    .description('List all labels in the workspace')
    .option('-t, --team <team>', 'Filter by team key')
    .option('-l, --limit <number>', 'Maximum number of labels to show', '50')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const client = await getAuthenticatedClient();
        
        // Build filter if team is specified
        let filter: Record<string, unknown> | undefined;
        
        if (options.team) {
          // Find team by key
          const teams = await client.teams();
          const team = teams.nodes.find(
            t => t.key.toUpperCase() === options.team.toUpperCase()
          );
          
          if (!team) {
            if (isJsonMode()) {
              outputJsonError('TEAM_NOT_FOUND', `Team "${options.team}" not found`);
              process.exit(ExitCodes.NOT_FOUND);
            }
            console.log(chalk.red(`Team "${options.team}" not found.`));
            console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
            process.exit(ExitCodes.NOT_FOUND);
          }
          
          filter = { team: { id: { eq: team.id } } };
        }
        
        const labels = await client.issueLabels({
          filter,
          first: parseInt(options.limit, 10),
        });
        
        if (isJsonMode()) {
          const labelsJson: LabelJson[] = labels.nodes.map(l => labelToJson(l));
          outputJson({ labels: labelsJson, count: labelsJson.length });
          return;
        }
        
        if (labels.nodes.length === 0) {
          console.log(chalk.yellow('No labels found.'));
          return;
        }
        
        console.log('');
        console.log(chalk.bold('Labels'));
        console.log(chalk.gray('─'.repeat(40)));
        
        for (const lbl of labels.nodes) {
          const colorBox = lbl.color ? chalk.hex(lbl.color)('[x]') : '   ';
          console.log(`${colorBox} ${lbl.name}`);
        }
        
        console.log('');
        console.log(chalk.gray(`Showing ${labels.nodes.length} label${labels.nodes.length === 1 ? '' : 's'}`));
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch labels.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // CREATE COMMAND
  // ─────────────────────────────────────────────────────────────────
  label
    .command('create [name]')
    .description('Create a new label')
    .option('-t, --team <team>', 'Team key for the label')
    .option('-c, --color <color>', 'Label color (hex code, e.g., #FF0000)')
    .option('-d, --description <description>', 'Label description')
    .action(async (name: string | undefined, options) => {
      try {
        const client = await getAuthenticatedClient();
        
        // Get teams for team selection
        const teams = await client.teams();
        
        if (teams.nodes.length === 0) {
          console.log(chalk.red('No teams found. Please create a team in Linear first.'));
          process.exit(1);
        }
        
        // Determine team
        let teamId: string;
        
        if (options.team) {
          const team = teams.nodes.find(
            t => t.key.toUpperCase() === options.team.toUpperCase()
          );
          if (!team) {
            console.log(chalk.red(`Team "${options.team}" not found.`));
            console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
            process.exit(1);
          }
          teamId = team.id;
        } else if (teams.nodes.length === 1) {
          teamId = teams.nodes[0].id;
        } else {
          teamId = await select({
            message: 'Select a team for this label:',
            choices: teams.nodes.map(t => ({
              name: `${t.key} - ${t.name}`,
              value: t.id,
            })),
          });
        }
        
        // Get label name if not provided
        const labelName = name || await input({
          message: 'Label name:',
          validate: (value) => value.trim() !== '' || 'Label name is required',
        });
        
        // Create the label
        const payload = await client.createIssueLabel({
          name: labelName.trim(),
          teamId,
          color: options.color || undefined,
          description: options.description || undefined,
        });
        const createdLabel = await payload.issueLabel;
        
        if (createdLabel) {
          console.log(chalk.green('Label created successfully!'));
          console.log('');
          const colorBox = createdLabel.color 
            ? chalk.hex(createdLabel.color)('[x]') 
            : '   ';
          console.log(`${colorBox} ${createdLabel.name}`);
        } else {
          console.log(chalk.red('Failed to create label.'));
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        console.log(chalk.red('Failed to create label.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(1);
      }
    });
}
