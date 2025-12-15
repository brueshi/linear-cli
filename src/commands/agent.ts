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
import type { ExtractedIssueData, AgentOptions, WorkspaceContext } from '../lib/agent/types.js';
import { formatIdentifier } from '../utils/format.js';

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
    if (options.project) {
      extracted.projectId = options.project;
    }
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
    let projectId = extracted.projectId;
    let projectName: string | undefined;
    
    // If project specified via flag, try to resolve it
    if (options.project && context) {
      const project = context.projects.find(p => 
        p.id === options.project || 
        p.name.toLowerCase().includes(options.project!.toLowerCase())
      );
      if (project) {
        projectId = project.id;
        projectName = project.name;
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
    
    // 12. Dry run - just show extraction
    if (options.dryRun) {
      console.log('');
      console.log(chalk.cyan('Extracted Data:'));
      console.log(JSON.stringify({
        title: extracted.title,
        teamKey: teamKey || null,
        projectId: projectId || null,
        issueType: extracted.issueType || null,
        priority: extracted.priority ?? null,
        description: extracted.description || null,
        labels: extracted.labels || null,
        estimate: extracted.estimate || null,
      }, null, 2));
      console.log('');
      console.log(chalk.gray('(No issue created - dry run mode)'));
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
      console.log(
        chalk.green('Created ') +
        formatIdentifier(createdIssue.identifier) +
        ' - ' +
        createdIssue.title
      );
      console.log(chalk.gray('  ' + createdIssue.url));
      
      // Show created labels
      if (createdLabels.length > 0) {
        console.log(chalk.gray(`  Created labels: ${createdLabels.join(', ')}`));
      }
      
      // Suggest git branch
      const branchName = createdIssue.identifier.toLowerCase() + '-' + 
        createdIssue.title.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40);
      console.log(chalk.gray(`  Branch: git checkout -b ${branchName}`));
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
        process.exit(1);
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
