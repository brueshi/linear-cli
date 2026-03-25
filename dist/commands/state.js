import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { isJsonMode, outputJson, outputJsonError, stateToJson, ExitCodes, } from '../utils/json-output.js';
/**
 * Color mapping for workflow state types
 */
const STATE_TYPE_COLORS = {
    backlog: chalk.gray,
    unstarted: chalk.blue,
    started: chalk.yellow,
    completed: chalk.green,
    canceled: chalk.red,
    triage: chalk.magenta,
};
/**
 * Register workflow state commands
 */
export function registerStateCommands(program) {
    const state = program
        .command('state')
        .description('View workflow states for teams');
    // ─────────────────────────────────────────────────────────────────
    // LIST COMMAND
    // ─────────────────────────────────────────────────────────────────
    state
        .command('list')
        .description('List workflow states for a team')
        .option('-t, --team <team>', 'Team key (shows all teams if omitted)')
        .option('--json', 'Output in JSON format')
        .action(async (options) => {
        try {
            const client = await getAuthenticatedClient();
            const teams = await client.teams();
            if (options.team) {
                const team = teams.nodes.find(t => t.key.toUpperCase() === options.team.toUpperCase());
                if (!team) {
                    if (isJsonMode()) {
                        outputJsonError('TEAM_NOT_FOUND', `Team "${options.team}" not found. Available: ${teams.nodes.map(t => t.key).join(', ')}`);
                        process.exit(ExitCodes.NOT_FOUND);
                    }
                    console.log(chalk.red(`Team "${options.team}" not found.`));
                    console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
                    process.exit(ExitCodes.NOT_FOUND);
                }
                const states = await team.states();
                const sorted = states.nodes.sort((a, b) => a.position - b.position);
                if (isJsonMode()) {
                    const statesJson = sorted.map(s => stateToJson(s));
                    outputJson({
                        team: { id: team.id, key: team.key, name: team.name },
                        states: statesJson,
                        count: statesJson.length,
                    });
                    return;
                }
                console.log('');
                console.log(chalk.bold(`Workflow States for ${team.key} (${team.name})`));
                console.log(chalk.gray('─'.repeat(50)));
                console.log('');
                for (const s of sorted) {
                    const colorFn = STATE_TYPE_COLORS[s.type] || chalk.white;
                    const dot = chalk.hex(s.color)('●');
                    console.log(`  ${dot} ${colorFn(s.name.padEnd(20))} ${chalk.gray(s.type)}`);
                }
                console.log('');
            }
            else {
                // Show states for all teams
                const allTeamStates = {};
                for (const team of teams.nodes) {
                    const states = await team.states();
                    const sorted = states.nodes.sort((a, b) => a.position - b.position);
                    allTeamStates[team.key] = {
                        team: { id: team.id, key: team.key, name: team.name },
                        states: sorted.map(s => stateToJson(s)),
                    };
                }
                if (isJsonMode()) {
                    outputJson({ teams: allTeamStates });
                    return;
                }
                console.log('');
                for (const [key, data] of Object.entries(allTeamStates)) {
                    console.log(chalk.bold(`${key} (${data.team.name})`));
                    console.log(chalk.gray('─'.repeat(50)));
                    for (const s of data.states) {
                        const colorFn = STATE_TYPE_COLORS[s.type] || chalk.white;
                        const dot = chalk.hex(s.color)('●');
                        console.log(`  ${dot} ${colorFn(s.name.padEnd(20))} ${chalk.gray(s.type)}`);
                    }
                    console.log('');
                }
            }
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to fetch workflow states.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
}
