import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { ConfigManager } from '../lib/config.js';
import { formatIdentifier } from '../utils/format.js';
export function registerQuickCommand(program) {
    program
        .command('quick <title>')
        .description('Rapid issue creation with minimal input')
        .option('-t, --team <team>', 'Team key (uses default if set)')
        .option('-p, --priority <priority>', 'Priority (1=Urgent, 2=High, 3=Medium, 4=Low)')
        .option('-d, --description <description>', 'Issue description')
        .action(async (title, options) => {
        try {
            const client = await getAuthenticatedClient();
            const config = ConfigManager.load();
            // Determine team
            let teamId;
            const teamKey = options.team || config.defaultTeam;
            if (teamKey) {
                // Look up team by key
                const teams = await client.teams();
                const team = teams.nodes.find(t => t.key.toUpperCase() === teamKey.toUpperCase());
                if (team) {
                    teamId = team.id;
                }
                else {
                    console.log(chalk.yellow(`Team "${teamKey}" not found.`));
                }
            }
            // If no team found, prompt for selection
            if (!teamId) {
                const teams = await client.teams();
                if (teams.nodes.length === 0) {
                    console.log(chalk.red('No teams found. Please create a team in Linear first.'));
                    process.exit(1);
                }
                if (teams.nodes.length === 1) {
                    teamId = teams.nodes[0].id;
                }
                else {
                    teamId = await select({
                        message: 'Select a team:',
                        choices: teams.nodes.map(t => ({
                            name: `${t.key} - ${t.name}`,
                            value: t.id,
                        })),
                    });
                }
            }
            // Determine priority
            const priority = options.priority
                ? parseInt(options.priority, 10)
                : config.defaultPriority || 0;
            // Create the issue
            const issuePayload = await client.createIssue({
                teamId,
                title: title.trim(),
                description: options.description?.trim() || undefined,
                priority: priority || undefined,
            });
            const createdIssue = await issuePayload.issue;
            if (createdIssue) {
                console.log(chalk.green('Created ') +
                    formatIdentifier(createdIssue.identifier) +
                    ' ' + createdIssue.title);
                console.log(chalk.gray(createdIssue.url));
            }
            else {
                console.log(chalk.red('Failed to create issue.'));
                process.exit(1);
            }
        }
        catch (error) {
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
