import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  projectToJson,
  ExitCodes,
  type ProjectJson,
} from '../utils/json-output.js';

/**
 * Format project state for display
 */
function formatProjectState(state: string): string {
  const stateColors: Record<string, (text: string) => string> = {
    planned: chalk.gray,
    started: chalk.blue,
    paused: chalk.yellow,
    completed: chalk.green,
    canceled: chalk.red,
    cancelled: chalk.red,
  };
  
  const colorFn = stateColors[state.toLowerCase()] || chalk.white;
  return colorFn(state.charAt(0).toUpperCase() + state.slice(1));
}

/**
 * Register project management commands
 */
export function registerProjectCommands(program: Command): void {
  const project = program
    .command('project')
    .description('Manage Linear projects');

  // ─────────────────────────────────────────────────────────────────
  // LIST COMMAND
  // ─────────────────────────────────────────────────────────────────
  project
    .command('list')
    .description('List all projects')
    .option('-t, --team <team>', 'Filter by team key')
    .option('-s, --state <state>', 'Filter by state (planned, started, paused, completed)')
    .option('-l, --limit <number>', 'Maximum number of projects to show', '25')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const client = await getAuthenticatedClient();
        
        // Build filter
        const filter: Record<string, unknown> = {};
        
        if (options.state) {
          filter.state = { eq: options.state.toLowerCase() };
        }
        
        const projects = await client.projects({
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: parseInt(options.limit, 10),
        });
        
        // Filter by team if specified
        let filteredProjects = projects.nodes;
        
        if (options.team) {
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
          
          // Filter projects by team association
          const projectsWithTeams = await Promise.all(
            projects.nodes.map(async (p) => {
              const projectTeams = await p.teams();
              return {
                project: p,
                hasTeam: projectTeams.nodes.some(t => t.id === team.id),
              };
            })
          );
          
          filteredProjects = projectsWithTeams
            .filter(p => p.hasTeam)
            .map(p => p.project);
        }
        
        if (isJsonMode()) {
          const projectsJson: ProjectJson[] = await Promise.all(
            filteredProjects.map(p => projectToJson(p))
          );
          outputJson({ projects: projectsJson, count: projectsJson.length });
          return;
        }
        
        if (filteredProjects.length === 0) {
          console.log(chalk.yellow('No projects found.'));
          return;
        }
        
        console.log('');
        console.log(chalk.bold('Projects'));
        console.log(chalk.gray('─'.repeat(60)));
        
        for (const proj of filteredProjects) {
          const state = formatProjectState(proj.state);
          const progress = proj.progress !== undefined 
            ? chalk.gray(` (${Math.round(proj.progress * 100)}%)`)
            : '';
          
          console.log(`${chalk.cyan(proj.name)} ${state}${progress}`);
          
          if (proj.description) {
            const desc = proj.description.slice(0, 60);
            console.log(chalk.gray(`  ${desc}${proj.description.length > 60 ? '...' : ''}`));
          }
        }
        
        console.log('');
        console.log(chalk.gray(`Showing ${filteredProjects.length} project${filteredProjects.length === 1 ? '' : 's'}`));
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch projects.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // VIEW COMMAND
  // ─────────────────────────────────────────────────────────────────
  project
    .command('view <name>')
    .description('View project details')
    .option('--json', 'Output in JSON format')
    .action(async (name: string) => {
      try {
        const client = await getAuthenticatedClient();
        
        // Search for project by name
        const projects = await client.projects({
          filter: { name: { containsIgnoreCase: name } },
          first: 10,
        });
        
        if (projects.nodes.length === 0) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Project "${name}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Project "${name}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }
        
        // If multiple matches, pick the exact match or first one
        let proj = projects.nodes.find(
          p => p.name.toLowerCase() === name.toLowerCase()
        ) || projects.nodes[0];
        
        // If multiple matches and no exact match, let user select (skip in JSON mode)
        if (!isJsonMode() && projects.nodes.length > 1 && !projects.nodes.find(
          p => p.name.toLowerCase() === name.toLowerCase()
        )) {
          const projectId = await select({
            message: 'Multiple projects found. Select one:',
            choices: projects.nodes.map(p => ({
              name: `${p.name} (${p.state})`,
              value: p.id,
            })),
          });
          proj = projects.nodes.find(p => p.id === projectId)!;
        }
        
        if (isJsonMode()) {
          const projectJson = await projectToJson(proj);
          outputJson({ project: projectJson });
          return;
        }
        
        // Get additional details
        const projectTeams = await proj.teams();
        const projectIssues = await proj.issues({ first: 5 });
        
        console.log('');
        console.log(chalk.bold(proj.name));
        console.log(chalk.gray('─'.repeat(40)));
        console.log('');
        
        console.log(chalk.gray('State:       ') + formatProjectState(proj.state));
        
        if (proj.progress !== undefined) {
          const progressBar = Math.round(proj.progress * 20);
          const bar = chalk.green('[' + '='.repeat(progressBar) + ' '.repeat(20 - progressBar) + ']');
          console.log(chalk.gray('Progress:    ') + bar + ` ${Math.round(proj.progress * 100)}%`);
        }
        
        if (projectTeams.nodes.length > 0) {
          console.log(chalk.gray('Teams:       ') + projectTeams.nodes.map(t => t.key).join(', '));
        }
        
        if (proj.startDate) {
          console.log(chalk.gray('Start:       ') + proj.startDate);
        }
        
        if (proj.targetDate) {
          console.log(chalk.gray('Target:      ') + proj.targetDate);
        }
        
        if (proj.description) {
          console.log('');
          console.log(chalk.gray('Description:'));
          console.log('  ' + proj.description);
        }
        
        if (projectIssues.nodes.length > 0) {
          console.log('');
          console.log(chalk.gray('Recent Issues:'));
          for (const issue of projectIssues.nodes) {
            const team = await issue.team;
            const identifier = team ? `${team.key}-${issue.number}` : `#${issue.number}`;
            console.log(`  ${chalk.cyan(identifier)} ${issue.title}`);
          }
        }
        
        console.log('');
        console.log(chalk.gray(proj.url));
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch project.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // CREATE COMMAND
  // ─────────────────────────────────────────────────────────────────
  project
    .command('create [name]')
    .description('Create a new project')
    .option('-t, --team <team>', 'Team key to associate with project')
    .option('-d, --description <description>', 'Project description')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--target-date <date>', 'Target completion date (YYYY-MM-DD)')
    .action(async (name: string | undefined, options) => {
      try {
        const client = await getAuthenticatedClient();
        
        // Get teams
        const teams = await client.teams();
        
        if (teams.nodes.length === 0) {
          console.log(chalk.red('No teams found. Please create a team in Linear first.'));
          process.exit(1);
        }
        
        // Determine team(s)
        let teamIds: string[];
        
        if (options.team) {
          const team = teams.nodes.find(
            t => t.key.toUpperCase() === options.team.toUpperCase()
          );
          if (!team) {
            console.log(chalk.red(`Team "${options.team}" not found.`));
            console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
            process.exit(1);
          }
          teamIds = [team.id];
        } else if (teams.nodes.length === 1) {
          teamIds = [teams.nodes[0].id];
        } else {
          const teamId = await select({
            message: 'Select a team for this project:',
            choices: teams.nodes.map(t => ({
              name: `${t.key} - ${t.name}`,
              value: t.id,
            })),
          });
          teamIds = [teamId];
        }
        
        // Get project name if not provided
        const projectName = name || await input({
          message: 'Project name:',
          validate: (value) => value.trim() !== '' || 'Project name is required',
        });
        
        // Get description if not provided
        let description = options.description;
        if (!description) {
          description = await input({
            message: 'Description (optional):',
          });
        }
        
        // Create the project
        const payload = await client.createProject({
          name: projectName.trim(),
          teamIds,
          description: description?.trim() || undefined,
          startDate: options.startDate || undefined,
          targetDate: options.targetDate || undefined,
        });
        const createdProject = await payload.project;
        
        if (createdProject) {
          console.log(chalk.green('Project created successfully!'));
          console.log('');
          console.log(chalk.cyan(createdProject.name) + ' ' + formatProjectState(createdProject.state));
          console.log(chalk.gray(createdProject.url));
        } else {
          console.log(chalk.red('Failed to create project.'));
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        console.log(chalk.red('Failed to create project.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(1);
      }
    });
}
