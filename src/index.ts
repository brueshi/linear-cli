#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerIssueCommands } from './commands/issue.js';
import { registerConfigCommands } from './commands/config.js';
import { registerQuickCommand } from './commands/quick.js';
import { registerBranchCommand } from './commands/branch.js';
import { registerCompletionCommand } from './commands/completion.js';

const program = new Command();

program
  .name('linear')
  .description('Command line interface for Linear issue management.\n\nManage issues, create branches, and streamline your workflow without leaving the terminal.')
  .version('0.1.0')
  .addHelpText('after', `
Examples:
  $ linear auth login                    # Authenticate with Linear
  $ linear issue list -t ENG             # List issues for team ENG
  $ linear issue create                  # Create issue interactively
  $ linear quick "Fix login bug"         # Quick issue creation
  $ linear branch ENG-123                # Create branch for issue
  $ linear config set defaultTeam ENG    # Set default team

Documentation:
  https://github.com/your-username/linear-cli
`);

// Register command groups
registerAuthCommands(program);
registerIssueCommands(program);
registerConfigCommands(program);
registerQuickCommand(program);
registerBranchCommand(program);
registerCompletionCommand(program);

// Handle unknown commands gracefully
program.on('command:*', (operands) => {
  console.error(`error: unknown command '${operands[0]}'`);
  console.error('');
  console.error('Run `linear --help` for usage information.');
  process.exit(1);
});

program.parse();
