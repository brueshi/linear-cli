import { select, input, editor } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { formatIssueRow, formatIssueDetails, printListHeader, formatIdentifier, formatState, } from '../utils/format.js';
/**
 * Find an issue by its identifier (e.g., "ENG-123")
 * Parses the team key and issue number to query correctly
 */
async function findIssueByIdentifier(client, identifier) {
    const normalized = identifier.toUpperCase();
    // Parse identifier format: TEAM-NUMBER (e.g., ENG-123)
    const match = normalized.match(/^([A-Z]+)-(\d+)$/);
    if (match) {
        const [, teamKey, numberStr] = match;
        const issueNumber = parseInt(numberStr, 10);
        // Find by team key and issue number
        const issues = await client.issues({
            filter: {
                team: { key: { eq: teamKey } },
                number: { eq: issueNumber },
            },
            first: 1,
        });
        return issues.nodes[0] || null;
    }
    // Fallback: try as a raw number across all teams
    const asNumber = parseInt(identifier, 10);
    if (!isNaN(asNumber)) {
        const issues = await client.issues({
            filter: { number: { eq: asNumber } },
            first: 1,
        });
        return issues.nodes[0] || null;
    }
    return null;
}
export function registerIssueCommands(program) {
    const issue = program
        .command('issue')
        .description('Manage Linear issues');
    // ─────────────────────────────────────────────────────────────────
    // LIST COMMAND
    // ─────────────────────────────────────────────────────────────────
    issue
        .command('list')
        .description('List issues with filtering options')
        .option('-t, --team <team>', 'Filter by team key (e.g., ENG)')
        .option('-s, --status <status>', 'Filter by status name')
        .option('-a, --assignee <assignee>', 'Filter by assignee (use "me" for yourself)')
        .option('-l, --limit <number>', 'Maximum number of issues to show', '25')
        .action(async (options) => {
        const client = await getAuthenticatedClient();
        // Build filter object
        const filter = {};
        if (options.team) {
            filter.team = { key: { eq: options.team.toUpperCase() } };
        }
        if (options.status) {
            filter.state = { name: { containsIgnoreCase: options.status } };
        }
        if (options.assignee) {
            if (options.assignee.toLowerCase() === 'me') {
                const viewer = await client.viewer;
                filter.assignee = { id: { eq: viewer.id } };
            }
            else {
                filter.assignee = { name: { containsIgnoreCase: options.assignee } };
            }
        }
        try {
            const issues = await client.issues({
                filter: Object.keys(filter).length > 0 ? filter : undefined,
                first: parseInt(options.limit, 10),
                orderBy: client.constructor.name ? undefined : undefined, // Use default ordering
            });
            if (issues.nodes.length === 0) {
                console.log(chalk.yellow('No issues found matching your criteria.'));
                return;
            }
            printListHeader();
            for (const iss of issues.nodes) {
                console.log(await formatIssueRow(iss));
            }
            console.log('');
            console.log(chalk.gray(`Showing ${issues.nodes.length} issue${issues.nodes.length === 1 ? '' : 's'}`));
        }
        catch (error) {
            console.log(chalk.red('Failed to fetch issues.'));
            if (error instanceof Error) {
                console.log(chalk.gray(error.message));
            }
            process.exit(1);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // CREATE COMMAND
    // ─────────────────────────────────────────────────────────────────
    issue
        .command('create')
        .description('Create a new issue (interactive)')
        .option('-t, --team <team>', 'Team key (e.g., ENG)')
        .option('--title <title>', 'Issue title')
        .option('--description <description>', 'Issue description')
        .option('-p, --priority <priority>', 'Priority (1=Urgent, 2=High, 3=Medium, 4=Low)')
        .action(async (options) => {
        try {
            const client = await getAuthenticatedClient();
            // Get available teams
            const teams = await client.teams();
            if (teams.nodes.length === 0) {
                console.log(chalk.red('No teams found. Please create a team in Linear first.'));
                process.exit(1);
            }
            // Select team (or use provided)
            let teamId;
            if (options.team) {
                const team = teams.nodes.find(t => t.key.toUpperCase() === options.team.toUpperCase());
                if (!team) {
                    console.log(chalk.red(`Team "${options.team}" not found.`));
                    console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
                    process.exit(1);
                }
                teamId = team.id;
            }
            else {
                const teamChoice = await select({
                    message: 'Select a team:',
                    choices: teams.nodes.map(t => ({
                        name: `${t.key} - ${t.name}`,
                        value: t.id,
                    })),
                });
                teamId = teamChoice;
            }
            // Get title
            const title = options.title || await input({
                message: 'Issue title:',
                validate: (value) => value.trim() !== '' || 'Title is required',
            });
            // Get description (optional, use editor for longer input)
            let description = options.description;
            if (!description) {
                const wantsDescription = await select({
                    message: 'Add a description?',
                    choices: [
                        { name: 'No', value: 'no' },
                        { name: 'Yes (open editor)', value: 'editor' },
                        { name: 'Yes (inline)', value: 'inline' },
                    ],
                });
                if (wantsDescription === 'editor') {
                    description = await editor({
                        message: 'Write your description (save and close to continue):',
                    });
                }
                else if (wantsDescription === 'inline') {
                    description = await input({
                        message: 'Description:',
                    });
                }
            }
            // Get priority
            let priority;
            if (options.priority) {
                priority = parseInt(options.priority, 10);
            }
            else {
                const priorityChoice = await select({
                    message: 'Priority:',
                    choices: [
                        { name: 'None', value: 0 },
                        { name: 'Urgent', value: 1 },
                        { name: 'High', value: 2 },
                        { name: 'Medium', value: 3 },
                        { name: 'Low', value: 4 },
                    ],
                    default: 0,
                });
                priority = priorityChoice;
            }
            // Create the issue
            console.log(chalk.gray('Creating issue...'));
            const issuePayload = await client.createIssue({
                teamId,
                title: title.trim(),
                description: description?.trim() || undefined,
                priority: priority || undefined,
            });
            const createdIssue = await issuePayload.issue;
            if (createdIssue) {
                console.log('');
                console.log(chalk.green('Issue created successfully!'));
                console.log('');
                console.log('  ' + formatIdentifier(createdIssue.identifier) + ' ' + createdIssue.title);
                console.log('  ' + chalk.underline(createdIssue.url));
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
    // ─────────────────────────────────────────────────────────────────
    // VIEW COMMAND
    // ─────────────────────────────────────────────────────────────────
    issue
        .command('view <id>')
        .description('Display issue details')
        .action(async (id) => {
        const client = await getAuthenticatedClient();
        try {
            const issue = await findIssueByIdentifier(client, id);
            if (!issue) {
                console.log(chalk.red(`Issue "${id}" not found.`));
                process.exit(1);
            }
            console.log('');
            console.log(await formatIssueDetails(issue));
        }
        catch (error) {
            console.log(chalk.red('Failed to fetch issue.'));
            if (error instanceof Error) {
                console.log(chalk.gray(error.message));
            }
            process.exit(1);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // UPDATE COMMAND
    // ─────────────────────────────────────────────────────────────────
    issue
        .command('update <id>')
        .description('Update an issue')
        .option('--title <title>', 'New title')
        .option('--description <description>', 'New description')
        .option('-p, --priority <priority>', 'Priority (1=Urgent, 2=High, 3=Medium, 4=Low)')
        .option('-s, --status <status>', 'New status name')
        .option('-a, --assignee <assignee>', 'Assign to user (use "me" for yourself, "none" to unassign)')
        .action(async (id, options) => {
        const client = await getAuthenticatedClient();
        try {
            // Find the issue
            const issue = await findIssueByIdentifier(client, id);
            if (!issue) {
                console.log(chalk.red(`Issue "${id}" not found.`));
                process.exit(1);
            }
            // Build update payload
            const updateData = {};
            if (options.title) {
                updateData.title = options.title;
            }
            if (options.description) {
                updateData.description = options.description;
            }
            if (options.priority) {
                updateData.priority = parseInt(options.priority, 10);
            }
            if (options.status) {
                // Find workflow state by name
                const team = await issue.team;
                if (team) {
                    const states = await team.states();
                    const state = states.nodes.find(s => s.name.toLowerCase().includes(options.status.toLowerCase()));
                    if (state) {
                        updateData.stateId = state.id;
                    }
                    else {
                        console.log(chalk.yellow(`Status "${options.status}" not found. Available states:`));
                        states.nodes.forEach(s => console.log('  - ' + s.name));
                        process.exit(1);
                    }
                }
            }
            if (options.assignee) {
                if (options.assignee.toLowerCase() === 'none') {
                    updateData.assigneeId = null;
                }
                else if (options.assignee.toLowerCase() === 'me') {
                    const viewer = await client.viewer;
                    updateData.assigneeId = viewer.id;
                }
                else {
                    // Search for user
                    const users = await client.users({
                        filter: { name: { containsIgnoreCase: options.assignee } },
                    });
                    if (users.nodes.length > 0) {
                        updateData.assigneeId = users.nodes[0].id;
                    }
                    else {
                        console.log(chalk.red(`User "${options.assignee}" not found.`));
                        process.exit(1);
                    }
                }
            }
            if (Object.keys(updateData).length === 0) {
                console.log(chalk.yellow('No updates specified. Use --help to see options.'));
                return;
            }
            console.log(chalk.gray('Updating issue...'));
            await issue.update(updateData);
            console.log(chalk.green(`Updated ${formatIdentifier(issue.identifier)}`));
        }
        catch (error) {
            console.log(chalk.red('Failed to update issue.'));
            if (error instanceof Error) {
                console.log(chalk.gray(error.message));
            }
            process.exit(1);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // CLOSE COMMAND
    // ─────────────────────────────────────────────────────────────────
    issue
        .command('close <id>')
        .description('Mark issue as completed')
        .action(async (id) => {
        const client = await getAuthenticatedClient();
        try {
            // Find the issue
            const issue = await findIssueByIdentifier(client, id);
            if (!issue) {
                console.log(chalk.red(`Issue "${id}" not found.`));
                process.exit(1);
            }
            // Get the team's "completed" state
            const team = await issue.team;
            if (!team) {
                console.log(chalk.red('Could not find team for this issue.'));
                process.exit(1);
            }
            const states = await team.states();
            const completedState = states.nodes.find(s => s.type === 'completed');
            if (!completedState) {
                console.log(chalk.red('Could not find a completed state for this team.'));
                process.exit(1);
            }
            const currentState = await issue.state;
            if (currentState?.type === 'completed') {
                console.log(chalk.yellow(`${formatIdentifier(issue.identifier)} is already completed.`));
                return;
            }
            console.log(chalk.gray('Closing issue...'));
            await issue.update({ stateId: completedState.id });
            console.log(chalk.green(`Closed ${formatIdentifier(issue.identifier)}`) +
                ' ' + chalk.gray('->') + ' ' + formatState(completedState));
        }
        catch (error) {
            console.log(chalk.red('Failed to close issue.'));
            if (error instanceof Error) {
                console.log(chalk.gray(error.message));
            }
            process.exit(1);
        }
    });
}
