import { Command } from 'commander';
import { select, confirm, input as textInput } from '@inquirer/prompts';
import chalk from 'chalk';
import { IssueRelationType } from '@linear/sdk';
import { getAuthenticatedClient } from '../lib/client.js';
import { ConfigManager } from '../lib/config.js';
import { AgentAIClient } from '../lib/agent/ai-client.js';
import { AnthropicAuthManager } from '../lib/agent/anthropic-auth.js';
import { ContextEngine } from '../lib/agent/context-engine.js';
import { IssueParser } from '../lib/agent/issue-parser.js';
import { Validator } from '../lib/agent/validator.js';
import { BatchProcessor, parseBatchInput } from '../lib/agent/batch-processor.js';
import { TemplateManager } from '../lib/agent/templates.js';
import { resolveOrCreateLabels } from '../lib/agent/labels.js';
import type { ExtractedIssueData, ExtractedUpdateData, AgentOptions, WorkspaceContext } from '../lib/agent/types.js';
import { formatIdentifier, divider, formatSuccess, formatWarning } from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  issueToJson,
  commentToJson,
  ExitCodes,
} from '../utils/json-output.js';

/**
 * Extended agent options with new features
 */
interface ExtendedAgentOptions extends AgentOptions {
  /** Parent issue ID for sub-issues */
  parent?: string;
  
  /** Related issue IDs */
  relatesTo?: string[];
  
  /** Use a template */
  template?: string;
  
  /** Batch mode - read from stdin */
  batch?: boolean;
  
  /** Continue on error in batch mode */
  continueOnError?: boolean;
}

/**
 * Word wrap text to a specified width
 */
function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

/**
 * Format a preview showing extracted issue data
 */
function formatPreviewBox(data: ExtractedIssueData, teamName?: string, projectName?: string): string {
  const lines: string[] = [];
  
  const addRow = (label: string, value: string) => {
    lines.push(chalk.gray(label.padEnd(12)) + value);
  };
  
  addRow('Title:', data.title);
  
  if (data.teamKey || teamName) {
    addRow('Team:', teamName ? `${teamName} (${data.teamKey})` : data.teamKey || '-');
  }
  
  if (projectName) {
    addRow('Project:', projectName);
  }
  
  if (data.issueType) {
    addRow('Type:', data.issueType.charAt(0).toUpperCase() + data.issueType.slice(1));
  }
  
  if (data.priority !== undefined && data.priority > 0) {
    const priorityLabels = ['None', 'Urgent', 'High', 'Medium', 'Low'];
    const priorityColors = [chalk.gray, chalk.red, chalk.yellow, chalk.blue, chalk.gray];
    addRow('Priority:', priorityColors[data.priority](priorityLabels[data.priority]));
  }
  
  if (data.estimate) {
    addRow('Estimate:', `${data.estimate} points`);
  }
  
  if (data.labels && data.labels.length > 0) {
    addRow('Labels:', data.labels.join(', '));
  }
  
  // Show description with word wrapping
  if (data.description) {
    lines.push('');
    lines.push(chalk.gray('Description:'));
    const paragraphs = data.description.split(/\n\n+/);
    for (const para of paragraphs) {
      const wrappedLines = wordWrap(para.replace(/\n/g, ' '), 70);
      for (const line of wrappedLines) {
        lines.push('  ' + line);
      }
      if (paragraphs.length > 1) lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Read stdin for batch input
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    
    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Main agent command action
 */
async function agentAction(input: string, options: ExtendedAgentOptions): Promise<void> {
  try {
    // Check for template usage
    if (options.template) {
      const templateResult = TemplateManager.apply(options.template, { title: input });
      if (!templateResult) {
        console.log(chalk.red(`Template "${options.template}" not found.`));
        console.log('Available templates: ' + TemplateManager.list().map(t => t.name).join(', '));
        process.exit(1);
      }
      input = templateResult.input;
      
      // Apply template defaults if not overridden
      if (templateResult.template.teamKey && !options.team) {
        options.team = templateResult.template.teamKey;
      }
      if (templateResult.template.priority !== undefined && !options.priority) {
        options.priority = String(templateResult.template.priority);
      }
    }

    // 1. Get Anthropic API key
    const anthropicApiKey = await AnthropicAuthManager.getApiKey();
    
    if (!anthropicApiKey) {
      console.log(chalk.red('Anthropic API key not found.'));
      console.log('');
      console.log('To use the agent command, you need an Anthropic API key.');
      console.log('Get one at: ' + chalk.cyan('https://console.anthropic.com/settings/keys'));
      console.log('');
      console.log('Then run: ' + chalk.cyan('linear agent-auth <your-api-key>'));
      process.exit(1);
    }
    
    // 2. Get Linear client and config
    const linearClient = await getAuthenticatedClient();
    const config = ConfigManager.load();
    
    // 3. Initialize components
    const contextEngine = new ContextEngine(linearClient);
    const issueParser = new IssueParser();
    const validator = new Validator();
    const aiClient = new AgentAIClient({ apiKey: anthropicApiKey });
    
    // 4. Show analyzing indicator
    if (!options.dryRun && !options.batch) {
      process.stdout.write(chalk.gray('Analyzing...'));
    }
    
    // 5. Fetch workspace context (unless disabled)
    let context: WorkspaceContext | undefined;
    if (options.context !== false && config.enableAgentContext !== false) {
      try {
        context = await contextEngine.fetchContext();
      } catch (error) {
        // Continue without context if fetch fails
        if (!options.dryRun && !options.batch) {
          process.stdout.write('\r' + ' '.repeat(20) + '\r');
          console.log(chalk.yellow('Warning: Could not fetch workspace context'));
        }
      }
    }

    // Validate --assign-to-me requires context
    if (options.assignToMe && !context) {
      console.log(chalk.red('Cannot use --assign-to-me without workspace context.'));
      console.log('');
      console.log('The --assign-to-me flag requires workspace context to determine your user ID.');
      if (options.context === false) {
        console.log('Remove the ' + chalk.cyan('--no-context') + ' flag, or assign manually after creation.');
      } else {
        console.log('Check your network connection and try again.');
      }
      process.exit(1);
    }

    // Handle batch mode
    if (options.batch) {
      if (!context) {
        console.log(chalk.red('Batch mode requires workspace context.'));
        process.exit(1);
      }
      
      // Read additional inputs from stdin
      const stdinData = await readStdin();
      const inputs = parseBatchInput(input + '\n' + stdinData);
      
      if (inputs.length === 0) {
        console.log(chalk.yellow('No inputs provided for batch processing.'));
        process.exit(1);
      }
      
      console.log(chalk.cyan(`Processing ${inputs.length} items...`));
      console.log('');
      
      const processor = new BatchProcessor(aiClient, linearClient, context, config);
      
      const result = await processor.processBatch(
        inputs,
        {
          teamKey: options.team,
          priority: options.priority ? parseInt(options.priority, 10) : undefined,
          assigneeId: options.assignToMe ? context.user.id : undefined,
          dryRun: options.dryRun,
          continueOnError: options.continueOnError ?? true,
          delayMs: 500, // Rate limit protection
        },
        (itemResult) => {
          // Progress callback
          if (itemResult.success) {
            if (options.dryRun) {
              console.log(chalk.green(`[${itemResult.lineNumber}]`) + ` ${itemResult.extracted?.title}`);
            } else {
              console.log(
                chalk.green(`[${itemResult.lineNumber}]`) + 
                ` Created ${formatIdentifier(itemResult.issueIdentifier!)} - ${itemResult.extracted?.title}`
              );
            }
          } else {
            console.log(
              chalk.red(`[${itemResult.lineNumber}]`) + 
              ` Failed: ${itemResult.error}`
            );
          }
        }
      );
      
      console.log('');
      console.log(chalk.bold('Batch Summary:'));
      console.log(`  Total: ${result.total}`);
      console.log(chalk.green(`  Succeeded: ${result.succeeded}`));
      if (result.failed > 0) {
        console.log(chalk.red(`  Failed: ${result.failed}`));
      }
      
      return;
    }
    
    // 6. Call AI to extract issue data
    let extracted: ExtractedIssueData;
    
    try {
      extracted = await aiClient.extractIssueData(input, context);
    } catch (error) {
      // Clear the "Analyzing..." text
      process.stdout.write('\r' + ' '.repeat(20) + '\r');
      
      if (error instanceof Error) {
        console.log(chalk.red('Failed to analyze input: ') + error.message);
        console.log('');
        console.log(chalk.gray('Tip: Try being more specific about what you want to create.'));
        console.log(chalk.gray('Example: linear agent "Fix login bug on Safari, backend team, urgent"'));
      }
      process.exit(1);
    }
    
    // Clear the "Analyzing..." text
    if (!options.dryRun) {
      process.stdout.write('\r' + ' '.repeat(20) + '\r');
    }
    
    // 7. Apply CLI flag overrides
    if (options.team) {
      extracted.teamKey = options.team.toUpperCase();
    }
    // Note: project is resolved later via API lookup, not stored in extracted
    if (options.priority) {
      const p = parseInt(options.priority, 10);
      if (p >= 0 && p <= 4) {
        extracted.priority = p;
      }
    }
    
    // 8. Apply defaults from config and workspace patterns
    if (context) {
      extracted = issueParser.applyDefaults(extracted, context, config);
    }
    
    // 9. Validate extracted data
    let validationResult;
    if (context) {
      validationResult = validator.validate(extracted, context);
      
      // Show warnings (but skip label warnings since we'll auto-create)
      for (const warning of validationResult.warnings) {
        if (!warning.includes('Labels not found')) {
          console.log(chalk.yellow('Warning: ') + warning);
        }
      }
      
      // Apply enriched data
      if (validationResult.enriched.teamId) {
        extracted.teamId = validationResult.enriched.teamId;
      }
      // Don't override labels from validator - we'll auto-create missing ones
    }
    
    // 10. Parse into Linear format
    let parseResult;
    if (context) {
      parseResult = issueParser.parse(extracted, context, config);
      
      // Show parse warnings (skip label warnings)
      for (const warning of parseResult.warnings) {
        if (!validationResult?.warnings.includes(warning) && !warning.includes('Labels not found')) {
          console.log(chalk.yellow('Warning: ') + warning);
        }
      }
    }
    
    // Resolve team info for display
    let teamId = extracted.teamId || parseResult?.team?.id;
    let teamName = parseResult?.team?.name;
    let teamKey = parseResult?.team?.key || extracted.teamKey;
    
    // If no team resolved yet, try to find it
    if (!teamId && context) {
      if (extracted.teamKey) {
        const team = context.teams.find(t => 
          t.key.toUpperCase() === extracted.teamKey?.toUpperCase()
        );
        if (team) {
          teamId = team.id;
          teamName = team.name;
          teamKey = team.key;
        }
      }
      
      // Use default from config
      if (!teamId && config.defaultTeam) {
        const team = context.teams.find(t => 
          t.key.toUpperCase() === config.defaultTeam?.toUpperCase()
        );
        if (team) {
          teamId = team.id;
          teamName = team.name;
          teamKey = team.key;
          extracted.teamKey = team.key;
        }
      }
      
      // Prompt if still no team and not in auto/dry-run mode
      if (!teamId && context.teams.length > 0 && !options.auto && !options.dryRun) {
        if (context.teams.length === 1) {
          teamId = context.teams[0].id;
          teamName = context.teams[0].name;
          teamKey = context.teams[0].key;
        } else {
          console.log('');
          teamId = await select({
            message: 'Select a team:',
            choices: context.teams.map(t => ({
              name: `${t.key} - ${t.name}`,
              value: t.id,
            })),
          });
          const selectedTeam = context.teams.find(t => t.id === teamId);
          if (selectedTeam) {
            teamName = selectedTeam.name;
            teamKey = selectedTeam.key;
            extracted.teamKey = selectedTeam.key;
          }
        }
      }
    }
    
    // 11. Project selection
    let projectId: string | undefined;
    let projectName: string | undefined;

    // Determine project source: CLI flag takes precedence, then AI extraction
    const projectToResolve = options.project || extracted.projectName;

    // If project specified via flag or AI extraction, try to resolve it
    if (projectToResolve) {
      // First try to find in cached context
      if (context) {
        const project = context.projects.find(p =>
          p.id === projectToResolve ||
          p.name.toLowerCase().includes(projectToResolve.toLowerCase())
        );
        if (project) {
          projectId = project.id;
          projectName = project.name;
        }
      }

      // If not found in context, search via API
      if (!projectId) {
        try {
          const projects = await linearClient.projects({
            filter: {
              or: [
                { name: { containsIgnoreCase: projectToResolve } },
                { id: { eq: projectToResolve } },
              ],
            },
            first: 1,
          });

          if (projects.nodes.length > 0) {
            projectId = projects.nodes[0].id;
            projectName = projects.nodes[0].name;
          } else if (options.project) {
            // Only warn if it was a CLI flag (not AI extraction that might be wrong)
            console.log(chalk.yellow(`Project "${projectToResolve}" not found, skipping.`));
          }
        } catch {
          if (options.project) {
            console.log(chalk.yellow(`Could not search for project "${projectToResolve}", skipping.`));
          }
        }
      }
    }

    // Prompt for project selection if not in auto mode and we have a team
    if (!projectId && teamId && context && !options.auto && !options.dryRun) {
      // Filter projects by team
      const teamProjects = context.projects.filter(p => 
        p.teamIds.includes(teamId!)
      );
      
      if (teamProjects.length > 0) {
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
        
        if (projectChoice) {
          projectId = projectChoice;
          const selectedProject = teamProjects.find(p => p.id === projectChoice);
          if (selectedProject) {
            projectName = selectedProject.name;
          }
        }
      }
    }
    
    // 12. Dry run - show detailed extraction with resolution info
    if (options.dryRun) {
      console.log('');
      console.log(chalk.bold.cyan('Dry Run - Extracted Issue Data'));
      console.log(divider(50));
      console.log('');

      // Title
      console.log(chalk.gray('Title:       ') + chalk.white(extracted.title));

      // Team - show resolved name
      if (teamId && teamName) {
        console.log(chalk.gray('Team:        ') + chalk.green(`${teamName} (${teamKey})`) + chalk.gray(' ✓ resolved'));
      } else if (teamKey) {
        console.log(chalk.gray('Team:        ') + chalk.yellow(`${teamKey}`) + chalk.gray(' (will attempt to resolve)'));
      } else if (config.defaultTeam) {
        console.log(chalk.gray('Team:        ') + chalk.blue(`${config.defaultTeam}`) + chalk.gray(' (from config default)'));
      } else {
        console.log(chalk.gray('Team:        ') + chalk.red('Not specified') + chalk.gray(' (will prompt)'));
      }

      // Project - show resolved name and source
      if (projectId && projectName) {
        const source = options.project ? '(from flag)' : extracted.projectName ? '(AI detected)' : '';
        console.log(chalk.gray('Project:     ') + chalk.green(projectName) + chalk.gray(` ✓ resolved ${source}`));
      } else if (options.project) {
        console.log(chalk.gray('Project:     ') + chalk.yellow(options.project) + chalk.gray(' (will search)'));
      } else if (extracted.projectName) {
        console.log(chalk.gray('Project:     ') + chalk.yellow(extracted.projectName) + chalk.gray(' (AI detected, will search)'));
      } else {
        console.log(chalk.gray('Project:     ') + chalk.gray('None'));
      }

      // Issue Type
      if (extracted.issueType) {
        const typeColors: Record<string, (s: string) => string> = {
          bug: chalk.red,
          feature: chalk.green,
          improvement: chalk.blue,
          task: chalk.gray,
        };
        const colorFn = typeColors[extracted.issueType] || chalk.white;
        console.log(chalk.gray('Type:        ') + colorFn(extracted.issueType.charAt(0).toUpperCase() + extracted.issueType.slice(1)));
      }

      // Priority
      if (extracted.priority !== undefined && extracted.priority > 0) {
        const priorityLabels = ['None', 'Urgent', 'High', 'Medium', 'Low'];
        const priorityColors = [chalk.gray, chalk.red, chalk.yellow, chalk.blue, chalk.gray];
        console.log(chalk.gray('Priority:    ') + priorityColors[extracted.priority](priorityLabels[extracted.priority]));
      }

      // Estimate
      if (extracted.estimate) {
        console.log(chalk.gray('Estimate:    ') + `${extracted.estimate} points`);
      }

      // Labels - show which exist vs will be created
      if (extracted.labels && extracted.labels.length > 0 && context) {
        const existingLabelNames = context.labels.map(l => l.name.toLowerCase());
        const matchedLabels: string[] = [];
        const newLabels: string[] = [];

        for (const label of extracted.labels) {
          if (existingLabelNames.includes(label.toLowerCase())) {
            matchedLabels.push(label);
          } else {
            newLabels.push(label);
          }
        }

        console.log(chalk.gray('Labels:'));
        if (matchedLabels.length > 0) {
          console.log(chalk.gray('  Existing:  ') + chalk.green(matchedLabels.join(', ')) + chalk.gray(' ✓'));
        }
        if (newLabels.length > 0) {
          console.log(chalk.gray('  To create: ') + chalk.yellow(newLabels.join(', ')) + chalk.gray(' (will be created)'));
        }
      } else if (extracted.labels && extracted.labels.length > 0) {
        console.log(chalk.gray('Labels:      ') + extracted.labels.join(', '));
      }

      // Assignee
      if (options.assignToMe && context) {
        console.log(chalk.gray('Assignee:    ') + chalk.green(context.user.name || context.user.email) + chalk.gray(' (you)'));
      }

      // Parent issue
      if (options.parent) {
        console.log(chalk.gray('Parent:      ') + formatIdentifier(options.parent));
      }

      // Description
      if (extracted.description) {
        console.log('');
        console.log(chalk.gray('Description:'));
        const lines = extracted.description.split('\n');
        for (const line of lines.slice(0, 10)) {
          console.log(chalk.gray('  ') + line);
        }
        if (lines.length > 10) {
          console.log(chalk.gray(`  ... and ${lines.length - 10} more lines`));
        }
      }

      // Validation warnings
      if (validationResult && validationResult.warnings.length > 0) {
        const relevantWarnings = validationResult.warnings.filter(w => !w.includes('Labels not found'));
        if (relevantWarnings.length > 0) {
          console.log('');
          console.log(chalk.yellow('Warnings:'));
          for (const warning of relevantWarnings) {
            console.log(chalk.yellow(`  - ${warning}`));
          }
        }
      }

      console.log('');
      console.log(divider(50));
      console.log(chalk.gray('No issue created (dry run mode)'));
      console.log(chalk.gray('Remove --dry-run or -d to create the issue.'));
      return;
    }
    
    // 13. Verify we have a team
    if (!teamId) {
      console.log(chalk.red('Could not determine team for this issue.'));
      if (context && context.teams.length > 0) {
        console.log('Available teams: ' + context.teams.map(t => t.key).join(', '));
      }
      console.log('Use ' + chalk.cyan('--team <key>') + ' to specify a team.');
      process.exit(1);
    }
    
    // 14. Prompt for additional details (unless --auto)
    const skipConfirmation = options.auto || config.agentConfirmation === false;
    
    if (!skipConfirmation) {
      console.log('');
      console.log(formatPreviewBox(extracted, teamName, projectName));
      console.log('');
      
      // Prompt for additional description details
      const additionalDetails = await textInput({
        message: 'Provide a few key details (be explicit but concise):',
        default: '',
      });
      
      if (additionalDetails.trim()) {
        // Append additional details to description
        if (extracted.description) {
          extracted.description = `${extracted.description}\n\n${additionalDetails.trim()}`;
        } else {
          extracted.description = additionalDetails.trim();
        }
        
        // Refresh the preview with updated description
        console.log('');
        console.log(formatPreviewBox(extracted, teamName, projectName));
        console.log('');
      }
      
      const shouldCreate = await confirm({
        message: 'Create this issue?',
        default: true,
      });
      
      if (!shouldCreate) {
        console.log(chalk.gray('Cancelled.'));
        return;
      }
    }
    
    // 15. Resolve labels to IDs (auto-creating missing ones)
    let labelIds: string[] | undefined;
    let createdLabels: string[] = [];
    
    if (extracted.labels && extracted.labels.length > 0 && context) {
      const result = await resolveOrCreateLabels(
        linearClient,
        extracted.labels,
        context.labels,
        teamId
      );
      
      if (result.labelIds.length > 0) {
        labelIds = result.labelIds;
      }
      
      createdLabels = result.createdLabels;
    }
    
    // 16. Create issue in Linear
    const issuePayload = await linearClient.createIssue({
      teamId,
      title: extracted.title,
      description: extracted.description,
      priority: extracted.priority,
      estimate: extracted.estimate,
      labelIds,
      projectId,
      assigneeId: options.assignToMe ? context?.user.id : undefined,
      parentId: options.parent,
    });
    
    const createdIssue = await issuePayload.issue;
    
    if (createdIssue) {
      // Handle issue relations
      if (options.relatesTo && options.relatesTo.length > 0) {
        for (const relatedId of options.relatesTo) {
          try {
            // Find the related issue first to get its ID
            const relatedIssues = await linearClient.issues({
              filter: { 
                or: [
                  { id: { eq: relatedId } },
                  { number: { eq: parseInt(relatedId, 10) || 0 } },
                ]
              },
              first: 1,
            });
            
            if (relatedIssues.nodes.length > 0) {
              await linearClient.createIssueRelation({
                issueId: createdIssue.id,
                relatedIssueId: relatedIssues.nodes[0].id,
                type: IssueRelationType.Related,
              });
            } else {
              console.log(chalk.yellow(`Warning: Could not find issue ${relatedId}`));
            }
          } catch {
            console.log(chalk.yellow(`Warning: Could not create relation to ${relatedId}`));
          }
        }
      }
      
      console.log('');
      console.log(formatSuccess(
        'Created ' +
        formatIdentifier(createdIssue.identifier) +
        ' - ' +
        createdIssue.title
      ));
      console.log(chalk.gray('  URL: ') + chalk.underline(createdIssue.url));

      // Show project assignment
      if (projectName) {
        console.log(chalk.gray('  Project: ') + chalk.cyan(projectName));
      }

      // Show created labels
      if (createdLabels.length > 0) {
        console.log(chalk.gray('  Created labels: ') + createdLabels.map(l => chalk.magenta(l)).join(', '));
      }

      // Suggest git branch
      const branchName = createdIssue.identifier.toLowerCase() + '-' +
        createdIssue.title.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
      console.log(chalk.gray('  Branch: ') + chalk.cyan(`git checkout -b ${branchName}`));
    } else {
      console.log(chalk.red('Failed to create issue.'));
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log(chalk.gray('\nCancelled.'));
      return;
    }
    console.log(chalk.red('An error occurred.'));
    if (error instanceof Error) {
      console.log(chalk.gray(error.message));
    }
    process.exit(1);
  }
}

/**
 * Register the agent command
 */
export function registerAgentCommand(program: Command): void {
  program
    .command('agent <input>')
    .description('Create issue from natural language using AI')
    .option('-a, --auto', 'Skip confirmation, create immediately')
    .option('-d, --dry-run', 'Show extraction without creating issue')
    .option('-t, --team <key>', 'Override AI team detection')
    .option('-p, --project <name>', 'Assign to project (name or ID)')
    .option('-P, --priority <0-4>', 'Override AI priority detection')
    .option('-m, --assign-to-me', 'Assign issue to authenticated user')
    .option('--no-context', 'Disable workspace context fetching')
    .option('--template <name>', 'Use a saved template')
    .option('--parent <id>', 'Set parent issue (create as sub-issue)')
    .option('--relates-to <ids...>', 'Link to related issues')
    .option('--batch', 'Batch mode - process multiple inputs')
    .option('--continue-on-error', 'Continue batch on errors')
    .addHelpText('after', `
Examples:
  $ linear agent "Fix login bug, urgent, backend team"
  $ linear agent "Add dark mode support" --team FE --priority 2
  $ linear agent "Performance issue in dashboard" --dry-run
  $ linear agent "Critical auth failure" --auto --assign-to-me

Projects:
  $ linear agent "New feature" --project "Q1 Roadmap"
  $ linear agent "Bug fix" -p "Backend Refactor"

Templates:
  $ linear agent "login validation" --template bug
  $ linear agent "user export feature" --template feature

Sub-issues and linking:
  $ linear agent "Implement auth flow" --parent ATT-100
  $ linear agent "Related refactor" --relates-to ATT-101 ATT-102

Batch mode:
  $ echo -e "Fix bug A\\nFix bug B\\nFix bug C" | linear agent "" --batch --team ATT

The agent uses AI to extract structured issue data from your input.
It analyzes your workspace to suggest teams, labels, and priorities.
Labels mentioned will be auto-created if they don't exist.
    `)
    .action(agentAction);

  // ─────────────────────────────────────────────────────────────────
  // AGENT UPDATE COMMAND
  // ─────────────────────────────────────────────────────────────────
  program
    .command('agent-update <issue> <input>')
    .description('Update an issue using natural language with AI')
    .option('-a, --auto', 'Skip confirmation, apply immediately')
    .option('-d, --dry-run', 'Show extraction without applying changes')
    .option('--json', 'Output in JSON format')
    .addHelpText('after', `
Examples:
  $ linear agent-update ABC-123 "Fixed the bug, ready for review"
  $ linear agent-update ABC-123 "Moving to in progress, starting work now"
  $ linear agent-update ABC-123 "Completed the implementation, tests passing" --auto
  $ linear agent-update ABC-123 "Blocked waiting on API team" --dry-run

The agent interprets natural language to determine:
- Status changes (done, in progress, in review, blocked)
- Comments to add
- Priority changes
- Label additions/removals
    `)
    .action(async (issueId: string, input: string, options: { auto?: boolean; dryRun?: boolean }) => {
      try {
        // 1. Get Anthropic API key
        const anthropicApiKey = await AnthropicAuthManager.getApiKey();
        
        if (!anthropicApiKey) {
          if (isJsonMode()) {
            outputJsonError('AUTH_REQUIRED', 'Anthropic API key not found');
            process.exit(ExitCodes.AUTH_FAILURE);
          }
          console.log(chalk.red('Anthropic API key not found.'));
          console.log('Run: ' + chalk.cyan('linear agent-auth <your-api-key>'));
          process.exit(ExitCodes.AUTH_FAILURE);
        }
        
        // 2. Get Linear client
        const linearClient = await getAuthenticatedClient();
        
        // 3. Find the issue
        const normalizedId = issueId.toUpperCase();
        const match = normalizedId.match(/^([A-Z]+)-(\d+)$/);
        
        if (!match) {
          if (isJsonMode()) {
            outputJsonError('INVALID_ID', `Invalid issue identifier: ${issueId}`);
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
          console.log(chalk.red(`Invalid issue identifier: ${issueId}`));
          process.exit(ExitCodes.VALIDATION_ERROR);
        }
        
        const [, teamKey, numberStr] = match;
        const issueNumber = parseInt(numberStr, 10);
        
        const issues = await linearClient.issues({
          filter: {
            team: { key: { eq: teamKey } },
            number: { eq: issueNumber },
          },
          first: 1,
        });
        
        const issue = issues.nodes[0];
        
        if (!issue) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Issue "${issueId}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }
        
        // 4. Get current issue state
        const currentState = await issue.state;
        const currentStatus = currentState?.name || 'Unknown';
        
        // 5. Initialize AI client and context engine
        const aiClient = new AgentAIClient({ apiKey: anthropicApiKey });
        const contextEngine = new ContextEngine(linearClient);
        
        if (!isJsonMode() && !options.dryRun) {
          process.stdout.write(chalk.gray('Analyzing...'));
        }
        
        // 6. Fetch workspace context
        let context: WorkspaceContext | undefined;
        try {
          context = await contextEngine.fetchContext();
        } catch {
          // Continue without context
        }
        
        // 7. Extract update data using AI
        let extracted: ExtractedUpdateData;
        try {
          extracted = await aiClient.extractUpdateData(
            input,
            { identifier: issue.identifier, title: issue.title, currentStatus },
            context
          );
        } catch (error) {
          if (!isJsonMode()) {
            process.stdout.write('\r' + ' '.repeat(20) + '\r');
          }
          if (isJsonMode()) {
            outputJsonError('AI_FAILED', error instanceof Error ? error.message : 'AI extraction failed');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Failed to analyze input: ') + (error instanceof Error ? error.message : 'Unknown error'));
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        
        if (!isJsonMode() && !options.dryRun) {
          process.stdout.write('\r' + ' '.repeat(20) + '\r');
        }
        
        // 8. Dry run - show what would be done
        if (options.dryRun) {
          if (isJsonMode()) {
            outputJson({ 
              dryRun: true, 
              issue: { id: issue.id, identifier: issue.identifier },
              extracted 
            });
            return;
          }
          
          console.log('');
          console.log(chalk.bold.cyan('Dry Run - Extracted Update Data'));
          console.log(divider(50));
          console.log('');
          console.log(chalk.gray('Issue:       ') + formatIdentifier(issue.identifier) + ' ' + issue.title);
          console.log(chalk.gray('Current:     ') + currentStatus);
          console.log('');
          
          if (extracted.statusChange) {
            console.log(chalk.gray('Status:      ') + chalk.yellow(`-> ${extracted.statusChange}`));
          }
          if (extracted.comment) {
            console.log(chalk.gray('Comment:     ') + extracted.comment);
          }
          if (extracted.priorityChange !== undefined) {
            const priorityLabels = ['None', 'Urgent', 'High', 'Medium', 'Low'];
            console.log(chalk.gray('Priority:    ') + chalk.yellow(`-> ${priorityLabels[extracted.priorityChange]}`));
          }
          if (extracted.addLabels && extracted.addLabels.length > 0) {
            console.log(chalk.gray('Add Labels:  ') + extracted.addLabels.join(', '));
          }
          if (extracted.assigneeChange) {
            console.log(chalk.gray('Assignee:    ') + chalk.yellow(`-> ${extracted.assigneeChange}`));
          }
          
          console.log('');
          console.log(divider(50));
          console.log(chalk.gray('No changes made (dry run mode)'));
          return;
        }
        
        // 9. Check if there's anything to do
        const hasChanges = extracted.comment || 
                          extracted.statusChange || 
                          extracted.priorityChange !== undefined ||
                          extracted.addLabels?.length ||
                          extracted.assigneeChange ||
                          extracted.titleUpdate;
        
        if (!hasChanges) {
          if (isJsonMode()) {
            outputJson({ success: true, message: 'No changes detected', issue: { id: issue.id, identifier: issue.identifier } });
            return;
          }
          console.log(chalk.yellow('No changes detected from input.'));
          return;
        }
        
        // 10. Apply changes
        const updateData: Record<string, unknown> = {};
        const team = await issue.team;
        
        // Resolve status change
        if (extracted.statusChange && team) {
          const states = await team.states();
          const newState = states.nodes.find(
            s => s.name.toLowerCase().includes(extracted.statusChange!.toLowerCase())
          );
          if (newState) {
            updateData.stateId = newState.id;
          }
        }
        
        // Apply priority change
        if (extracted.priorityChange !== undefined) {
          updateData.priority = extracted.priorityChange;
        }
        
        // Apply title update
        if (extracted.titleUpdate) {
          updateData.title = extracted.titleUpdate;
        }
        
        // Apply assignee change
        if (extracted.assigneeChange) {
          if (extracted.assigneeChange === 'none') {
            updateData.assigneeId = null;
          } else if (extracted.assigneeChange === 'me' && context) {
            updateData.assigneeId = context.user.id;
          }
        }
        
        // 11. Update issue if there are field changes
        if (Object.keys(updateData).length > 0) {
          await issue.update(updateData);
        }
        
        // 12. Add comment if present
        let createdComment = null;
        if (extracted.comment) {
          const commentResult = await linearClient.createComment({
            issueId: issue.id,
            body: extracted.comment,
          });
          createdComment = await commentResult.comment;
        }
        
        // 13. Output results
        if (isJsonMode()) {
          const updatedIssue = await linearClient.issue(issue.id);
          const issueJson = await issueToJson(updatedIssue);
          const result: Record<string, unknown> = {
            success: true,
            issue: issueJson,
            changes: {
              statusChanged: !!extracted.statusChange,
              commentAdded: !!extracted.comment,
              priorityChanged: extracted.priorityChange !== undefined,
            },
          };
          if (createdComment) {
            result.comment = await commentToJson(createdComment);
          }
          outputJson(result);
          return;
        }
        
        console.log('');
        console.log(formatSuccess(`Updated ${formatIdentifier(issue.identifier)}`));
        
        if (extracted.statusChange) {
          console.log(chalk.gray('  Status: ') + chalk.yellow(`-> ${extracted.statusChange}`));
        }
        if (extracted.comment) {
          console.log(chalk.gray('  Comment added'));
        }
        if (extracted.priorityChange !== undefined) {
          const priorityLabels = ['None', 'Urgent', 'High', 'Medium', 'Low'];
          console.log(chalk.gray('  Priority: ') + chalk.yellow(`-> ${priorityLabels[extracted.priorityChange]}`));
        }
        
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
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

  // Separate command for setting Anthropic API key
  program
    .command('agent-auth <api-key>')
    .description('Configure Anthropic API key for agent command')
    .action(async (apiKey: string) => {
      try {
        await AnthropicAuthManager.saveApiKey(apiKey);
        console.log(chalk.green('Anthropic API key saved successfully.'));
        console.log('You can now use ' + chalk.cyan('linear agent') + ' to create issues with AI.');
      } catch (error) {
        console.log(chalk.red('Failed to save API key.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // Template management commands
  const agentTemplate = program
    .command('agent-template')
    .description('Manage agent templates');

  agentTemplate
    .command('list')
    .description('List all templates')
    .action(() => {
      const templates = TemplateManager.list();
      console.log(chalk.bold('Available Templates:'));
      console.log('');
      for (const template of templates) {
        console.log(chalk.cyan(template.name));
        console.log(chalk.gray(`  Pattern: "${template.pattern}"`));
        if (template.teamKey) {
          console.log(chalk.gray(`  Team: ${template.teamKey}`));
        }
        if (template.priority !== undefined) {
          const priorities = ['None', 'Urgent', 'High', 'Medium', 'Low'];
          console.log(chalk.gray(`  Priority: ${priorities[template.priority]}`));
        }
        if (template.description) {
          console.log(chalk.gray(`  ${template.description}`));
        }
        console.log('');
      }
    });

  agentTemplate
    .command('save <name> <pattern>')
    .description('Save a new template (pattern can include {title} placeholder)')
    .option('-t, --team <key>', 'Default team')
    .option('-P, --priority <0-4>', 'Default priority')
    .option('--description <text>', 'Template description')
    .action((name: string, pattern: string, options) => {
      const template = {
        name: name.toLowerCase(),
        pattern,
        teamKey: options.team?.toUpperCase(),
        priority: options.priority ? parseInt(options.priority, 10) : undefined,
        description: options.description,
      };
      
      TemplateManager.set(template);
      console.log(chalk.green(`Template "${name}" saved.`));
      console.log(`Usage: ${chalk.cyan(`linear agent "your title" --template ${name}`)}`);
    });

  agentTemplate
    .command('delete <name>')
    .description('Delete a custom template')
    .action((name: string) => {
      const deleted = TemplateManager.delete(name);
      if (deleted) {
        console.log(chalk.green(`Template "${name}" deleted.`));
      } else {
        console.log(chalk.yellow(`Template "${name}" is a default template and cannot be deleted.`));
      }
    });

  agentTemplate
    .command('reset')
    .description('Reset templates to defaults')
    .action(() => {
      TemplateManager.reset();
      console.log(chalk.green('Templates reset to defaults.'));
    });
}
