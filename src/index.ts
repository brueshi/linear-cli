#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerIssueCommands } from './commands/issue.js';
import { registerConfigCommands } from './commands/config.js';
import { registerQuickCommand } from './commands/quick.js';
import { registerBranchCommand } from './commands/branch.js';
import { registerCompletionCommand } from './commands/completion.js';
import { registerAgentCommand } from './commands/agent.js';
import { registerProjectCommands } from './commands/project.js';
import { registerLabelCommands } from './commands/label.js';
import { registerSearchCommands } from './commands/search.js';
import { registerMeCommand } from './commands/me.js';
import { registerCommentCommands } from './commands/comment.js';
import { registerBatchCommands } from './commands/batch.js';
import { registerSyncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('linear')
  .description('Command line interface for Linear issue management.\n\nManage issues, create branches, and streamline your workflow without leaving the terminal.')
  .version('0.2.0')
  .addHelpText('after', `
Examples:
  $ linear auth login                    # Authenticate with Linear
  $ linear issue list -t ENG             # List issues for team ENG
  $ linear issue create                  # Create issue interactively
  $ linear quick "Fix login bug"         # Quick issue creation
  $ linear agent "Fix auth bug, urgent"  # AI-powered issue creation
  $ linear search "authentication"       # Search issues
  $ linear me                            # View your dashboard
  $ linear comment list ENG-123          # View comments on issue
  $ linear batch update ENG-1 ENG-2 -s done  # Bulk update issues
  $ linear branch ENG-123                # Create branch for issue
  $ linear sync                          # Refresh workspace cache

Documentation:
  https://github.com/your-username/linear-cli
`);

// Register command groups
registerAuthCommands(program);
registerIssueCommands(program);
registerProjectCommands(program);
registerLabelCommands(program);
registerConfigCommands(program);
registerQuickCommand(program);
registerBranchCommand(program);
registerCompletionCommand(program);
registerAgentCommand(program);
registerSearchCommands(program);
registerMeCommand(program);
registerCommentCommands(program);
registerBatchCommands(program);
registerSyncCommand(program);

// Handle unknown commands gracefully
program.on('command:*', (operands) => {
  console.error(`error: unknown command '${operands[0]}'`);
  console.error('');
  console.error('Run `linear --help` for usage information.');
  process.exit(1);
});

program.parse();
