import { Command } from 'commander';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { ContextEngine } from '../lib/agent/context-engine.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  ExitCodes,
  type WorkspaceContextJson,
  type TeamJson,
  type StateJson,
} from '../utils/json-output.js';

/**
 * Register the context command
 * 
 * This command provides workspace context in JSON format for coding agents
 * (Cursor, Claude Code) to understand the Linear workspace structure.
 */
export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description('Get workspace context for coding agents (teams, projects, labels, states)')
    .option('--json', 'Output in JSON format (default: true for this command)')
    .option('-t, --team <key>', 'Filter context to specific team')
    .option('--teams-only', 'Only output team information')
    .option('--projects-only', 'Only output project information')
    .option('--labels-only', 'Only output label information')
    .option('--states-only', 'Only output workflow state information')
    .option('--refresh', 'Force refresh cached context')
    .addHelpText('after', `
Examples:
  $ linear context                    # Full workspace context as JSON
  $ linear context --teams-only       # Just team information
  $ linear context --team BE          # Context filtered to BE team
  $ linear context --labels-only      # Just label information
  $ linear context --refresh          # Force refresh from API

This command is designed for coding agents to understand the workspace.
Use this before creating/updating issues to know available teams, projects, etc.
    `)
    .action(async (options) => {
      try {
        const client = await getAuthenticatedClient();
        const contextEngine = new ContextEngine(client);

        // Force refresh if requested
        if (options.refresh) {
          contextEngine.invalidateCache();
        }

        // Fetch context
        const context = await contextEngine.fetchContext();

        // Filter by team if specified
        let filteredTeams = context.teams;
        let filteredProjects = context.projects;
        let filteredStates = context.states;

        if (options.team) {
          const teamKey = options.team.toUpperCase();
          const team = context.teams.find(t => t.key.toUpperCase() === teamKey);
          
          if (!team) {
            if (isJsonMode() || options.json !== false) {
              outputJsonError('TEAM_NOT_FOUND', `Team "${options.team}" not found`);
            } else {
              console.log(chalk.red(`Team "${options.team}" not found.`));
              console.log('Available teams: ' + context.teams.map(t => t.key).join(', '));
            }
            process.exit(ExitCodes.NOT_FOUND);
          }

          filteredTeams = [team];
          filteredProjects = context.projects.filter(p => p.teamIds.includes(team.id));
          
          // Fetch team-specific states
          const teamStates = await client.workflowStates({
            filter: { team: { id: { eq: team.id } } },
          });
          filteredStates = teamStates.nodes.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
          }));
        }

        // Build response based on filters
        if (options.teamsOnly) {
          const teams: TeamJson[] = filteredTeams.map(t => ({
            id: t.id,
            key: t.key,
            name: t.name,
          }));
          
          if (isJsonMode() || options.json !== false) {
            outputJson({ teams });
          } else {
            console.log(chalk.bold('Teams:'));
            for (const team of teams) {
              console.log(`  ${chalk.cyan(team.key)} - ${team.name}`);
            }
          }
          return;
        }

        if (options.projectsOnly) {
          const projects = filteredProjects.map(p => ({
            id: p.id,
            name: p.name,
            teamIds: p.teamIds,
          }));
          
          if (isJsonMode() || options.json !== false) {
            outputJson({ projects });
          } else {
            console.log(chalk.bold('Projects:'));
            for (const project of projects) {
              console.log(`  ${chalk.cyan(project.name)}`);
            }
          }
          return;
        }

        if (options.labelsOnly) {
          const labels = context.labels.map(l => ({
            id: l.id,
            name: l.name,
          }));
          
          if (isJsonMode() || options.json !== false) {
            outputJson({ labels });
          } else {
            console.log(chalk.bold('Labels:'));
            for (const label of labels) {
              console.log(`  ${chalk.magenta(label.name)}`);
            }
          }
          return;
        }

        if (options.statesOnly) {
          const states: StateJson[] = filteredStates.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            color: '',
            position: 0,
          }));
          
          if (isJsonMode() || options.json !== false) {
            outputJson({ states });
          } else {
            console.log(chalk.bold('Workflow States:'));
            for (const state of states) {
              console.log(`  ${state.name} (${chalk.gray(state.type)})`);
            }
          }
          return;
        }

        // Full context output
        const fullContext: WorkspaceContextJson = {
          user: {
            id: context.user.id,
            name: context.user.name,
            email: context.user.email,
          },
          teams: filteredTeams.map(t => ({
            id: t.id,
            key: t.key,
            name: t.name,
          })),
          projects: filteredProjects.map(p => ({
            id: p.id,
            name: p.name,
            teamIds: p.teamIds,
          })),
          labels: context.labels.map(l => ({
            id: l.id,
            name: l.name,
          })),
          states: filteredStates.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            color: '',
            position: 0,
          })),
        };

        // This command defaults to JSON output since it's designed for coding agents
        if (isJsonMode() || options.json !== false) {
          outputJson(fullContext);
        } else {
          // Human-readable fallback
          console.log(chalk.bold('\nWorkspace Context\n'));
          
          console.log(chalk.bold('User:'));
          console.log(`  ${context.user.name} (${context.user.email})`);
          console.log('');
          
          console.log(chalk.bold('Teams:'));
          for (const team of filteredTeams) {
            console.log(`  ${chalk.cyan(team.key)} - ${team.name}`);
          }
          console.log('');
          
          console.log(chalk.bold('Projects:'));
          if (filteredProjects.length === 0) {
            console.log(chalk.gray('  No projects'));
          } else {
            for (const project of filteredProjects) {
              console.log(`  ${chalk.cyan(project.name)}`);
            }
          }
          console.log('');
          
          console.log(chalk.bold('Labels:'));
          if (context.labels.length === 0) {
            console.log(chalk.gray('  No labels'));
          } else {
            const labelNames = context.labels.map(l => l.name).join(', ');
            console.log(`  ${labelNames}`);
          }
          console.log('');
          
          console.log(chalk.bold('Workflow States:'));
          for (const state of filteredStates) {
            console.log(`  ${state.name} (${chalk.gray(state.type)})`);
          }
        }
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('CONTEXT_FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
        } else {
          console.log(chalk.red('Failed to fetch workspace context.'));
          if (error instanceof Error) {
            console.log(chalk.gray(error.message));
          }
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });
}
