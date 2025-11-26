import { Command } from 'commander';
import chalk from 'chalk';

const BASH_COMPLETION = `###-begin-linear-completions-###
_linear_completions() {
    local cur prev words cword
    _init_completion || return

    local commands="auth issue config quick branch"
    local auth_commands="login logout status"
    local issue_commands="list create view update close"
    local config_commands="set get list unset reset"

    case "\${COMP_CWORD}" in
        1)
            COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
            ;;
        2)
            case "\${prev}" in
                auth)
                    COMPREPLY=($(compgen -W "\${auth_commands}" -- "\${cur}"))
                    ;;
                issue)
                    COMPREPLY=($(compgen -W "\${issue_commands}" -- "\${cur}"))
                    ;;
                config)
                    COMPREPLY=($(compgen -W "\${config_commands}" -- "\${cur}"))
                    ;;
            esac
            ;;
    esac
}
complete -F _linear_completions linear
###-end-linear-completions-###`;

const ZSH_COMPLETION = `#compdef linear

_linear() {
    local -a commands auth_commands issue_commands config_commands

    commands=(
        'auth:Manage Linear authentication'
        'issue:Manage Linear issues'
        'config:Manage CLI configuration'
        'quick:Rapid issue creation with minimal input'
        'branch:Generate and create git branch from issue'
    )

    auth_commands=(
        'login:Store API key securely in keychain'
        'logout:Remove stored credentials'
        'status:Display current authentication state'
    )

    issue_commands=(
        'list:List issues with filtering options'
        'create:Create a new issue'
        'view:Display issue details'
        'update:Update an issue'
        'close:Mark issue as completed'
    )

    config_commands=(
        'set:Set a configuration option'
        'get:Get a configuration value'
        'list:Display all configuration'
        'unset:Remove a configuration value'
        'reset:Reset all configuration to defaults'
    )

    _arguments -C \\
        '1: :->command' \\
        '2: :->subcommand' \\
        '*::arg:->args'

    case $state in
        command)
            _describe -t commands 'linear command' commands
            ;;
        subcommand)
            case $words[2] in
                auth)
                    _describe -t auth_commands 'auth command' auth_commands
                    ;;
                issue)
                    _describe -t issue_commands 'issue command' issue_commands
                    ;;
                config)
                    _describe -t config_commands 'config command' config_commands
                    ;;
            esac
            ;;
    esac
}

_linear "$@"`;

const FISH_COMPLETION = `# Fish completions for linear

# Main commands
complete -c linear -n "__fish_use_subcommand" -a "auth" -d "Manage Linear authentication"
complete -c linear -n "__fish_use_subcommand" -a "issue" -d "Manage Linear issues"
complete -c linear -n "__fish_use_subcommand" -a "config" -d "Manage CLI configuration"
complete -c linear -n "__fish_use_subcommand" -a "quick" -d "Rapid issue creation"
complete -c linear -n "__fish_use_subcommand" -a "branch" -d "Generate git branch from issue"

# Auth subcommands
complete -c linear -n "__fish_seen_subcommand_from auth" -a "login" -d "Store API key in keychain"
complete -c linear -n "__fish_seen_subcommand_from auth" -a "logout" -d "Remove stored credentials"
complete -c linear -n "__fish_seen_subcommand_from auth" -a "status" -d "Display authentication state"

# Issue subcommands
complete -c linear -n "__fish_seen_subcommand_from issue" -a "list" -d "List issues"
complete -c linear -n "__fish_seen_subcommand_from issue" -a "create" -d "Create a new issue"
complete -c linear -n "__fish_seen_subcommand_from issue" -a "view" -d "Display issue details"
complete -c linear -n "__fish_seen_subcommand_from issue" -a "update" -d "Update an issue"
complete -c linear -n "__fish_seen_subcommand_from issue" -a "close" -d "Mark issue as completed"

# Config subcommands
complete -c linear -n "__fish_seen_subcommand_from config" -a "set" -d "Set a configuration option"
complete -c linear -n "__fish_seen_subcommand_from config" -a "get" -d "Get a configuration value"
complete -c linear -n "__fish_seen_subcommand_from config" -a "list" -d "Display all configuration"
complete -c linear -n "__fish_seen_subcommand_from config" -a "unset" -d "Remove a configuration value"
complete -c linear -n "__fish_seen_subcommand_from config" -a "reset" -d "Reset configuration"

# Issue list options
complete -c linear -n "__fish_seen_subcommand_from issue; and __fish_seen_subcommand_from list" -s t -l team -d "Filter by team"
complete -c linear -n "__fish_seen_subcommand_from issue; and __fish_seen_subcommand_from list" -s s -l status -d "Filter by status"
complete -c linear -n "__fish_seen_subcommand_from issue; and __fish_seen_subcommand_from list" -s a -l assignee -d "Filter by assignee"

# Quick options
complete -c linear -n "__fish_seen_subcommand_from quick" -s t -l team -d "Team key"
complete -c linear -n "__fish_seen_subcommand_from quick" -s p -l priority -d "Priority (1-4)"
complete -c linear -n "__fish_seen_subcommand_from quick" -s d -l description -d "Description"

# Branch options
complete -c linear -n "__fish_seen_subcommand_from branch" -s s -l style -d "Branch style"
complete -c linear -n "__fish_seen_subcommand_from branch" -l copy -d "Copy to clipboard"
complete -c linear -n "__fish_seen_subcommand_from branch" -l no-checkout -d "Don't switch to branch"`;

export function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion script')
    .argument('<shell>', 'Shell type: bash, zsh, or fish')
    .action((shell: string) => {
      const shellLower = shell.toLowerCase();
      
      switch (shellLower) {
        case 'bash':
          console.log(BASH_COMPLETION);
          console.log('');
          console.log(chalk.gray('# Add to ~/.bashrc:'));
          console.log(chalk.gray('# eval "$(linear completion bash)"'));
          break;
          
        case 'zsh':
          console.log(ZSH_COMPLETION);
          console.log('');
          console.log(chalk.gray('# Add to ~/.zshrc:'));
          console.log(chalk.gray('# eval "$(linear completion zsh)"'));
          break;
          
        case 'fish':
          console.log(FISH_COMPLETION);
          console.log('');
          console.log(chalk.gray('# Save to ~/.config/fish/completions/linear.fish'));
          break;
          
        default:
          console.log(chalk.red(`Unknown shell: ${shell}`));
          console.log(chalk.gray('Supported shells: bash, zsh, fish'));
          process.exit(1);
      }
    });
}

