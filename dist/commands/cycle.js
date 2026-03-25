import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { findIssueByIdentifier } from '../utils/find-issue.js';
import { formatIdentifier, formatDate, truncate, formatProgressBar } from '../utils/format.js';
import { isJsonMode, outputJson, outputJsonError, cycleToJson, issueToJson, ExitCodes, } from '../utils/json-output.js';
/**
 * Register cycle management commands
 */
export function registerCycleCommands(program) {
    const cycle = program
        .command('cycle')
        .description('Manage Linear cycles (sprints)');
    // ─────────────────────────────────────────────────────────────────
    // LIST COMMAND
    // ─────────────────────────────────────────────────────────────────
    cycle
        .command('list')
        .description('List cycles for a team')
        .option('-t, --team <team>', 'Team key (required if multiple teams)')
        .option('-l, --limit <number>', 'Maximum number of cycles', '10')
        .option('--upcoming', 'Show only upcoming cycles')
        .option('--past', 'Show only completed cycles')
        .option('--json', 'Output in JSON format')
        .action(async (options) => {
        try {
            const client = await getAuthenticatedClient();
            // Resolve team
            const teams = await client.teams();
            let team;
            if (options.team) {
                team = teams.nodes.find(t => t.key.toUpperCase() === options.team.toUpperCase());
                if (!team) {
                    if (isJsonMode()) {
                        outputJsonError('TEAM_NOT_FOUND', `Team "${options.team}" not found. Available: ${teams.nodes.map(t => t.key).join(', ')}`);
                        process.exit(ExitCodes.NOT_FOUND);
                    }
                    console.log(chalk.red(`Team "${options.team}" not found.`));
                    console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
                    process.exit(ExitCodes.NOT_FOUND);
                }
            }
            else if (teams.nodes.length === 1) {
                team = teams.nodes[0];
            }
            else {
                if (isJsonMode()) {
                    outputJsonError('TEAM_REQUIRED', `Multiple teams found. Specify one with -t: ${teams.nodes.map(t => t.key).join(', ')}`);
                    process.exit(ExitCodes.VALIDATION_ERROR);
                }
                console.log(chalk.yellow('Multiple teams found. Please specify a team with -t.'));
                console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
                process.exit(ExitCodes.VALIDATION_ERROR);
            }
            const now = new Date();
            const filter = {};
            if (options.upcoming) {
                filter.startsAt = { gt: now.toISOString() };
            }
            else if (options.past) {
                filter.endsAt = { lt: now.toISOString() };
            }
            const cycles = await team.cycles({
                first: parseInt(options.limit, 10),
                filter: Object.keys(filter).length > 0 ? filter : undefined,
            });
            if (isJsonMode()) {
                const cyclesJson = await Promise.all(cycles.nodes.map(c => cycleToJson(c)));
                outputJson({ cycles: cyclesJson, count: cyclesJson.length });
                return;
            }
            if (cycles.nodes.length === 0) {
                console.log(chalk.yellow('No cycles found.'));
                return;
            }
            console.log('');
            console.log(chalk.bold(`Cycles for ${team.key}`));
            console.log(chalk.gray('─'.repeat(70)));
            for (const c of cycles.nodes) {
                const start = new Date(c.startsAt);
                const end = new Date(c.endsAt);
                const isCurrent = now >= start && now <= end;
                const isPast = now > end;
                const nameStr = c.name || `Cycle ${c.number}`;
                const label = isCurrent ? chalk.green(' [ACTIVE]') : isPast ? chalk.gray(' [DONE]') : chalk.blue(' [UPCOMING]');
                const dateRange = `${formatDate(start)} - ${formatDate(end)}`;
                const progress = formatProgressBar(c.completedIssueCountHistory[c.completedIssueCountHistory.length - 1] || 0, c.issueCountHistory[c.issueCountHistory.length - 1] || 0, 15);
                console.log(`${chalk.cyan(nameStr)}${label}`);
                console.log(`  ${chalk.gray('Period:')} ${dateRange}`);
                console.log(`  ${chalk.gray('Progress:')} ${progress} (${c.completedIssueCountHistory[c.completedIssueCountHistory.length - 1] || 0}/${c.issueCountHistory[c.issueCountHistory.length - 1] || 0} issues)`);
                console.log('');
            }
            console.log(chalk.gray(`Showing ${cycles.nodes.length} cycle${cycles.nodes.length === 1 ? '' : 's'}`));
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to fetch cycles.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // CURRENT COMMAND
    // ─────────────────────────────────────────────────────────────────
    cycle
        .command('current')
        .description('Show the active cycle and its issues')
        .option('-t, --team <team>', 'Team key')
        .option('--json', 'Output in JSON format')
        .action(async (options) => {
        try {
            const client = await getAuthenticatedClient();
            const teams = await client.teams();
            let team;
            if (options.team) {
                team = teams.nodes.find(t => t.key.toUpperCase() === options.team.toUpperCase());
                if (!team) {
                    if (isJsonMode()) {
                        outputJsonError('TEAM_NOT_FOUND', `Team "${options.team}" not found. Available: ${teams.nodes.map(t => t.key).join(', ')}`);
                        process.exit(ExitCodes.NOT_FOUND);
                    }
                    console.log(chalk.red(`Team "${options.team}" not found.`));
                    console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
                    process.exit(ExitCodes.NOT_FOUND);
                }
            }
            else if (teams.nodes.length === 1) {
                team = teams.nodes[0];
            }
            else {
                if (isJsonMode()) {
                    outputJsonError('TEAM_REQUIRED', `Multiple teams found. Specify one with -t: ${teams.nodes.map(t => t.key).join(', ')}`);
                    process.exit(ExitCodes.VALIDATION_ERROR);
                }
                console.log(chalk.yellow('Multiple teams found. Please specify a team with -t.'));
                console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
                process.exit(ExitCodes.VALIDATION_ERROR);
            }
            const activeCycle = await team.activeCycle;
            if (!activeCycle) {
                if (isJsonMode()) {
                    outputJson({ cycle: null, message: 'No active cycle' });
                    return;
                }
                console.log(chalk.yellow(`No active cycle for team ${team.key}.`));
                return;
            }
            // Get cycle issues
            const issues = await activeCycle.issues({ first: 50 });
            if (isJsonMode()) {
                const cycleJson = await cycleToJson(activeCycle);
                const issuesJson = await Promise.all(issues.nodes.map(i => issueToJson(i)));
                outputJson({ cycle: cycleJson, issues: issuesJson });
                return;
            }
            const nameStr = activeCycle.name || `Cycle ${activeCycle.number}`;
            const start = new Date(activeCycle.startsAt);
            const end = new Date(activeCycle.endsAt);
            const totalIssues = activeCycle.issueCountHistory[activeCycle.issueCountHistory.length - 1] || 0;
            const completedIssues = activeCycle.completedIssueCountHistory[activeCycle.completedIssueCountHistory.length - 1] || 0;
            const progress = formatProgressBar(completedIssues, totalIssues);
            console.log('');
            console.log(chalk.bold(`${nameStr}`) + chalk.green(' [ACTIVE]'));
            console.log(chalk.gray('─'.repeat(60)));
            console.log(chalk.gray('Period:    ') + `${formatDate(start)} - ${formatDate(end)}`);
            console.log(chalk.gray('Progress:  ') + progress + ` (${completedIssues}/${totalIssues})`);
            console.log('');
            if (issues.nodes.length > 0) {
                console.log(chalk.bold('Issues:'));
                for (const issue of issues.nodes) {
                    const state = await issue.state;
                    const assignee = await issue.assignee;
                    const stateStr = state ? chalk[state.type === 'completed' ? 'green' : state.type === 'started' ? 'yellow' : 'gray'](state.name) : '';
                    const assigneeStr = assignee ? chalk.gray(` (${assignee.name || assignee.email})`) : '';
                    console.log(`  ${formatIdentifier(issue.identifier.padEnd(10))} ${truncate(issue.title, 40).padEnd(42)} ${stateStr}${assigneeStr}`);
                }
            }
            console.log('');
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to fetch active cycle.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // ADD-ISSUE COMMAND
    // ─────────────────────────────────────────────────────────────────
    cycle
        .command('add-issue <issue>')
        .description('Add an issue to the current or specified cycle')
        .option('-t, --team <team>', 'Team key (for resolving cycle)')
        .option('-c, --cycle <number>', 'Cycle number (defaults to active cycle)')
        .option('--json', 'Output in JSON format')
        .action(async (issueId, options) => {
        try {
            const client = await getAuthenticatedClient();
            const issue = await findIssueByIdentifier(client, issueId);
            if (!issue) {
                if (isJsonMode()) {
                    outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
                    process.exit(ExitCodes.NOT_FOUND);
                }
                console.log(chalk.red(`Issue "${issueId}" not found.`));
                process.exit(ExitCodes.NOT_FOUND);
            }
            // Find the cycle
            const team = await issue.team;
            if (!team) {
                if (isJsonMode()) {
                    outputJsonError('TEAM_NOT_FOUND', 'Could not determine team for issue');
                    process.exit(ExitCodes.GENERAL_ERROR);
                }
                console.log(chalk.red('Could not determine team for issue.'));
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            let cycleId;
            if (options.cycle) {
                // Find specific cycle by number
                const cycles = await team.cycles({
                    filter: { number: { eq: parseInt(options.cycle, 10) } },
                    first: 1,
                });
                if (cycles.nodes.length === 0) {
                    if (isJsonMode()) {
                        outputJsonError('NOT_FOUND', `Cycle ${options.cycle} not found for team ${team.key}`);
                        process.exit(ExitCodes.NOT_FOUND);
                    }
                    console.log(chalk.red(`Cycle ${options.cycle} not found for team ${team.key}.`));
                    process.exit(ExitCodes.NOT_FOUND);
                }
                cycleId = cycles.nodes[0].id;
            }
            else {
                // Use active cycle
                const activeCycle = await team.activeCycle;
                if (!activeCycle) {
                    if (isJsonMode()) {
                        outputJsonError('NO_ACTIVE_CYCLE', `No active cycle for team ${team.key}`);
                        process.exit(ExitCodes.NOT_FOUND);
                    }
                    console.log(chalk.yellow(`No active cycle for team ${team.key}. Use -c to specify a cycle number.`));
                    process.exit(ExitCodes.NOT_FOUND);
                }
                cycleId = activeCycle.id;
            }
            await issue.update({ cycleId });
            if (isJsonMode()) {
                const issueJson = await issueToJson(issue);
                outputJson({ issue: issueJson, cycleId });
                return;
            }
            console.log(chalk.green(`Added ${formatIdentifier(issue.identifier)} to cycle.`));
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('UPDATE_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to add issue to cycle.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // REMOVE-ISSUE COMMAND
    // ─────────────────────────────────────────────────────────────────
    cycle
        .command('remove-issue <issue>')
        .description('Remove an issue from its cycle')
        .option('--json', 'Output in JSON format')
        .action(async (issueId) => {
        try {
            const client = await getAuthenticatedClient();
            const issue = await findIssueByIdentifier(client, issueId);
            if (!issue) {
                if (isJsonMode()) {
                    outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
                    process.exit(ExitCodes.NOT_FOUND);
                }
                console.log(chalk.red(`Issue "${issueId}" not found.`));
                process.exit(ExitCodes.NOT_FOUND);
            }
            await issue.update({ cycleId: null });
            if (isJsonMode()) {
                const issueJson = await issueToJson(issue);
                outputJson({ issue: issueJson });
                return;
            }
            console.log(chalk.green(`Removed ${formatIdentifier(issue.identifier)} from its cycle.`));
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('UPDATE_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to remove issue from cycle.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
}
