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
import { registerContextCommand } from './commands/context.js';
import { registerAttachmentCommands } from './commands/attachment.js';
import { registerPrCommand } from './commands/pr.js';
import { registerCycleCommands } from './commands/cycle.js';
import { registerRelationCommands } from './commands/relation.js';
import { registerStateCommands } from './commands/state.js';
import { registerDocCommands } from './commands/doc.js';
import { registerProjectUpdateCommands } from './commands/project-update.js';
import { enableJsonMode } from './utils/json-output.js';
const program = new Command();
// Global --json flag handler
program.hook('preAction', (thisCommand, actionCommand) => {
    // Check for --json flag in the action command or any parent
    let cmd = actionCommand;
    while (cmd) {
        if (cmd.opts().json) {
            enableJsonMode();
            break;
        }
        cmd = cmd.parent;
    }
});
program
    .name('linear')
    .description('Command line interface for Linear issue management.\n\nManage issues, create branches, and streamline your workflow without leaving the terminal.')
    .version('0.1.0')
    .addHelpText('after', `
Examples:
  $ linear auth login                    # Authenticate with Linear
  $ linear issue list -t ENG             # List issues for team ENG
  $ linear issue create                  # Create issue interactively
  $ linear issue children ENG-123        # List sub-issues
  $ linear quick "Fix login bug"         # Quick issue creation
  $ linear agent "Fix auth bug, urgent"  # AI-powered issue creation
  $ linear search "authentication"       # Search issues
  $ linear me                            # View your dashboard
  $ linear cycle current -t ENG          # View active sprint
  $ linear relation add ENG-1 blocks ENG-2  # Link issues
  $ linear state list -t ENG             # View workflow states
  $ linear doc list                      # List documents
  $ linear project-update create "Proj"  # Post status update
  $ linear comment list ENG-123          # View comments on issue
  $ linear batch update ENG-1 ENG-2 -s done  # Bulk update issues
  $ linear branch ENG-123                # Create branch for issue
  $ linear sync                          # Refresh workspace cache

Documentation:
  https://github.com/brueshi/linear-cli
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
registerContextCommand(program);
registerAttachmentCommands(program);
registerPrCommand(program);
registerCycleCommands(program);
registerRelationCommands(program);
registerStateCommands(program);
registerDocCommands(program);
registerProjectUpdateCommands(program);
// Handle unknown commands gracefully
program.on('command:*', (operands) => {
    console.error(`error: unknown command '${operands[0]}'`);
    console.error('');
    console.error('Run `linear --help` for usage information.');
    process.exit(1);
});
program.parse();
