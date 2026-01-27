import { Command } from 'commander';
import { select, input, editor, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import type { LinearClient, Issue } from '@linear/sdk';
import { getAuthenticatedClient } from '../lib/client.js';
import { resolveOrCreateLabels, parseLabels } from '../lib/agent/labels.js';
import {
  formatIssueRow,
  formatIssueDetails,
  printListHeader,
  formatIdentifier,
  formatState,
} from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  issueToJson,
  ExitCodes,
  type IssueJson,
} from '../utils/json-output.js';

/**
 * Find an issue by its identifier (e.g., "ENG-123")
 * Parses the team key and issue number to query correctly
 */
async function findIssueByIdentifier(client: LinearClient, identifier: string): Promise<Issue | null> {
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

/**
 * Find a project by name or ID
 */
async function findProject(client: LinearClient, nameOrId: string): Promise<{ id: string; name: string } | null> {
  const projects = await client.projects({
    filter: {
      or: [
        { name: { containsIgnoreCase: nameOrId } },
        { id: { eq: nameOrId } },
      ],
    },
    first: 1,
  });
  
  if (projects.nodes.length > 0) {
    return {
      id: projects.nodes[0].id,
      name: projects.nodes[0].name,
    };
  }
  
  return null;
}

export function registerIssueCommands(program: Command): void {
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
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      const client = await getAuthenticatedClient();
      
      // Build filter object
      const filter: Record<string, unknown> = {};
      
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
        } else {
          filter.assignee = { name: { containsIgnoreCase: options.assignee } };
        }
      }
      
      try {
        const issues = await client.issues({
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: parseInt(options.limit, 10),
          orderBy: client.constructor.name ? undefined : undefined, // Use default ordering
        });
        
        if (isJsonMode()) {
          const issuesJson: IssueJson[] = await Promise.all(
            issues.nodes.map(iss => issueToJson(iss))
          );
          outputJson({ issues: issuesJson, count: issuesJson.length });
          return;
        }
        
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
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch issues.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
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
    .option('--project <project>', 'Project name or ID')
    .option('--label <labels>', 'Labels (comma-separated)')
    .option('--json', 'Output in JSON format')
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
        let teamId: string;
        
        if (options.team) {
          const team = teams.nodes.find(t => t.key.toUpperCase() === options.team.toUpperCase());
          if (!team) {
            console.log(chalk.red(`Team "${options.team}" not found.`));
            console.log('Available teams: ' + teams.nodes.map(t => t.key).join(', '));
            process.exit(1);
          }
          teamId = team.id;
        } else {
          const teamChoice = await select({
            message: 'Select a team:',
            choices: teams.nodes.map(t => ({
              name: `${t.key} - ${t.name}`,
              value: t.id,
            })),
          });
          teamId = teamChoice;
        }
        
        // Fetch projects for the selected team
        const allProjects = await client.projects({ first: 100 });
        const teamProjects: Array<{ id: string; name: string }> = [];
        
        for (const proj of allProjects.nodes) {
          const projTeams = await proj.teams();
          if (projTeams.nodes.some(t => t.id === teamId)) {
            teamProjects.push({ id: proj.id, name: proj.name });
          }
        }
        
        // Select project (or use provided)
        let projectId: string | undefined;
        
        if (options.project) {
          const project = await findProject(client, options.project);
          if (project) {
            projectId = project.id;
          } else {
            console.log(chalk.yellow(`Project "${options.project}" not found, skipping.`));
          }
        } else if (teamProjects.length > 0) {
          const projectChoice = await select({
            message: 'Assign to project (optional):',
            choices: [
              { name: 'None', value: '' },
              ...teamProjects.map(p => ({
                name: p.name,
                value: p.id,
              })),
            ],
          });
          projectId = projectChoice || undefined;
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
          } else if (wantsDescription === 'inline') {
            description = await input({
              message: 'Description:',
            });
          }
        }
        
        // Get priority
        let priority: number | undefined;
        if (options.priority) {
          priority = parseInt(options.priority, 10);
        } else {
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
        
        // Handle labels
        let labelIds: string[] | undefined;
        const existingLabels = await client.issueLabels({ first: 100 });
        const labelContext = existingLabels.nodes.map(l => ({ id: l.id, name: l.name }));
        
        if (options.label) {
          // Parse command line labels and resolve/create them
          const labelNames = parseLabels(options.label);
          if (labelNames.length > 0) {
            const result = await resolveOrCreateLabels(client, labelNames, labelContext, teamId);
            labelIds = result.labelIds;
            
            if (result.createdLabels.length > 0) {
              console.log(chalk.gray(`Created labels: ${result.createdLabels.join(', ')}`));
            }
          }
        } else if (labelContext.length > 0) {
          // Interactive label selection
          const selectedLabels = await checkbox({
            message: 'Select labels (optional):',
            choices: labelContext.map(l => ({
              name: l.name,
              value: l.id,
            })),
          });
          
          if (selectedLabels.length > 0) {
            labelIds = selectedLabels;
          }
        }
        
        // Create the issue
        if (!isJsonMode()) {
          console.log(chalk.gray('Creating issue...'));
        }
        
        const issuePayload = await client.createIssue({
          teamId,
          title: title.trim(),
          description: description?.trim() || undefined,
          priority: priority || undefined,
          projectId,
          labelIds,
        });
        
        const createdIssue = await issuePayload.issue;
        
        if (createdIssue) {
          if (isJsonMode()) {
            const issueJson = await issueToJson(createdIssue);
            outputJson({ issue: issueJson });
            return;
          }
          console.log('');
          console.log(chalk.green('Issue created successfully!'));
          console.log('');
          console.log('  ' + formatIdentifier(createdIssue.identifier) + ' ' + createdIssue.title);
          console.log('  ' + chalk.underline(createdIssue.url));
        } else {
          if (isJsonMode()) {
            outputJsonError('CREATE_FAILED', 'Failed to create issue');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Failed to create issue.'));
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
        console.log(chalk.red('Failed to create issue.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // VIEW COMMAND
  // ─────────────────────────────────────────────────────────────────
  issue
    .command('view <id>')
    .description('Display issue details')
    .option('--json', 'Output in JSON format')
    .action(async (id: string) => {
      const client = await getAuthenticatedClient();
      
      try {
        const issue = await findIssueByIdentifier(client, id);
        
        if (!issue) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Issue "${id}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Issue "${id}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }
        
        if (isJsonMode()) {
          const issueJson = await issueToJson(issue);
          outputJson({ issue: issueJson });
          return;
        }
        
        console.log('');
        console.log(await formatIssueDetails(issue));
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch issue.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
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
    .option('--project <project>', 'Move to project (use "none" to remove from project)')
    .option('--label <labels>', 'Set labels (comma-separated, replaces existing)')
    .option('--add-label <labels>', 'Add labels (comma-separated)')
    .option('--json', 'Output in JSON format')
    .action(async (id: string, options) => {
      const client = await getAuthenticatedClient();
      
      try {
        // Find the issue
        const issue = await findIssueByIdentifier(client, id);
        
        if (!issue) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Issue "${id}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Issue "${id}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }
        
        // Build update payload
        const updateData: Record<string, unknown> = {};
        
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
            const state = states.nodes.find(
              s => s.name.toLowerCase().includes(options.status.toLowerCase())
            );
            if (state) {
              updateData.stateId = state.id;
            } else {
              console.log(chalk.yellow(`Status "${options.status}" not found. Available states:`));
              states.nodes.forEach(s => console.log('  - ' + s.name));
              process.exit(1);
            }
          }
        }
        
        if (options.assignee) {
          if (options.assignee.toLowerCase() === 'none') {
            updateData.assigneeId = null;
          } else if (options.assignee.toLowerCase() === 'me') {
            const viewer = await client.viewer;
            updateData.assigneeId = viewer.id;
          } else {
            // Search for user
            const users = await client.users({
              filter: { name: { containsIgnoreCase: options.assignee } },
            });
            if (users.nodes.length > 0) {
              updateData.assigneeId = users.nodes[0].id;
            } else {
              console.log(chalk.red(`User "${options.assignee}" not found.`));
              process.exit(1);
            }
          }
        }
        
        // Handle project update
        if (options.project) {
          if (options.project.toLowerCase() === 'none') {
            updateData.projectId = null;
          } else {
            const project = await findProject(client, options.project);
            if (project) {
              updateData.projectId = project.id;
            } else {
              console.log(chalk.red(`Project "${options.project}" not found.`));
              process.exit(1);
            }
          }
        }
        
        // Handle label updates
        if (options.label || options.addLabel) {
          const team = await issue.team;
          const teamId = team?.id;
          
          if (!teamId) {
            console.log(chalk.red('Could not determine team for label update.'));
            process.exit(1);
          }
          
          const existingLabels = await client.issueLabels({ first: 100 });
          const labelContext = existingLabels.nodes.map(l => ({ id: l.id, name: l.name }));
          
          if (options.label) {
            // Replace all labels
            const labelNames = parseLabels(options.label);
            if (labelNames.length > 0) {
              const result = await resolveOrCreateLabels(client, labelNames, labelContext, teamId);
              updateData.labelIds = result.labelIds;
              
              if (result.createdLabels.length > 0) {
                console.log(chalk.gray(`Created labels: ${result.createdLabels.join(', ')}`));
              }
            } else {
              updateData.labelIds = [];
            }
          } else if (options.addLabel) {
            // Add labels to existing
            const currentLabels = await issue.labels();
            const currentLabelIds = currentLabels.nodes.map(l => l.id);
            
            const labelNames = parseLabels(options.addLabel);
            const result = await resolveOrCreateLabels(client, labelNames, labelContext, teamId);
            
            if (result.createdLabels.length > 0) {
              console.log(chalk.gray(`Created labels: ${result.createdLabels.join(', ')}`));
            }
            
            // Merge with existing labels
            updateData.labelIds = [...new Set([...currentLabelIds, ...result.labelIds])];
          }
        }
        
        if (Object.keys(updateData).length === 0) {
          if (isJsonMode()) {
            outputJsonError('NO_UPDATES', 'No updates specified');
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
          console.log(chalk.yellow('No updates specified. Use --help to see options.'));
          return;
        }
        
        if (!isJsonMode()) {
          console.log(chalk.gray('Updating issue...'));
        }
        await issue.update(updateData);
        
        // Refetch the issue to get updated state
        const updatedIssue = await findIssueByIdentifier(client, id);
        
        if (isJsonMode()) {
          if (updatedIssue) {
            const issueJson = await issueToJson(updatedIssue);
            outputJson({ issue: issueJson });
          } else {
            outputJson({ success: true, identifier: issue.identifier });
          }
          return;
        }
        
        console.log(chalk.green(`Updated ${formatIdentifier(issue.identifier)}`));
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('UPDATE_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to update issue.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // CLOSE COMMAND
  // ─────────────────────────────────────────────────────────────────
  issue
    .command('close <id>')
    .description('Mark issue as completed')
    .option('--json', 'Output in JSON format')
    .action(async (id: string) => {
      const client = await getAuthenticatedClient();
      
      try {
        // Find the issue
        const issue = await findIssueByIdentifier(client, id);
        
        if (!issue) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Issue "${id}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Issue "${id}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }
        
        // Get the team's "completed" state
        const team = await issue.team;
        if (!team) {
          if (isJsonMode()) {
            outputJsonError('TEAM_NOT_FOUND', 'Could not find team for this issue');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Could not find team for this issue.'));
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        
        const states = await team.states();
        const completedState = states.nodes.find(s => s.type === 'completed');
        
        if (!completedState) {
          if (isJsonMode()) {
            outputJsonError('STATE_NOT_FOUND', 'Could not find a completed state for this team');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Could not find a completed state for this team.'));
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        
        const currentState = await issue.state;
        
        if (currentState?.type === 'completed') {
          if (isJsonMode()) {
            const issueJson = await issueToJson(issue);
            outputJson({ issue: issueJson, alreadyClosed: true });
            return;
          }
          console.log(chalk.yellow(`${formatIdentifier(issue.identifier)} is already completed.`));
          return;
        }
        
        if (!isJsonMode()) {
          console.log(chalk.gray('Closing issue...'));
        }
        await issue.update({ stateId: completedState.id });
        
        // Refetch to get updated state
        const closedIssue = await findIssueByIdentifier(client, id);
        
        if (isJsonMode()) {
          if (closedIssue) {
            const issueJson = await issueToJson(closedIssue);
            outputJson({ issue: issueJson });
          } else {
            outputJson({ success: true, identifier: issue.identifier });
          }
          return;
        }
        
        console.log(
          chalk.green(`Closed ${formatIdentifier(issue.identifier)}`) + 
          ' ' + chalk.gray('->') + ' ' + formatState(completedState)
        );
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('CLOSE_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to close issue.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });
}
