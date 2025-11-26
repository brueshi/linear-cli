# Linear CLI

A command line interface for [Linear](https://linear.app) issue management. Create issues, manage workflows, and generate git branches without leaving the terminal.

## Installation

```bash
npm install -g @brueshi/linear-cli
```

## Quick Start

```bash
# Authenticate with your Linear API key
linear auth login

# List your issues
linear issue list

# Create an issue quickly
linear quick "Fix the login bug"

# Create a git branch for an issue
linear branch ATT-123
```

## Getting Your API Key

1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Click "Create Key"
3. Copy the key and use it with `linear auth login`

## Commands

### Authentication

```bash
linear auth login     # Store API key securely in system keychain
linear auth logout    # Remove stored credentials
linear auth status    # Check authentication state
```

### Issues

```bash
# List issues
linear issue list                    # List recent issues
linear issue list -t ATT             # Filter by team
linear issue list -s "in progress"   # Filter by status
linear issue list -a me              # Show your assigned issues
linear issue list -l 10              # Limit results

# Create issues
linear issue create                  # Interactive creation
linear issue create -t ATT --title "Bug fix"

# View and manage
linear issue view ATT-123            # View issue details
linear issue update ATT-123 -s done  # Update status
linear issue update ATT-123 -a me    # Assign to yourself
linear issue close ATT-123           # Mark as completed
```

### Quick Create

Create issues with minimal input:

```bash
linear quick "Fix login bug"                    # Basic
linear quick "Urgent fix" -p 1                  # With priority (1=Urgent)
linear quick "New feature" -t ATT -d "Details"  # With team and description
```

### Git Branch Generation

Generate and create git branches from issues:

```bash
linear branch ATT-123              # Create and checkout branch
linear branch ATT-123 --copy       # Copy branch name to clipboard
linear branch ATT-123 --style kebab  # Use different naming style
linear branch                      # Select from recent issues
```

Branch styles:
- `feature` (default): `feature/att-123-fix-login-bug`
- `kebab`: `att-123-fix-login-bug`
- `plain`: `att-123/fix-login-bug`

### Configuration

```bash
linear config list                    # Show all settings
linear config set defaultTeam ATT     # Set default team
linear config set branchStyle kebab   # Set branch naming style
linear config get defaultTeam         # Get a value
linear config unset defaultTeam       # Remove a setting
linear config reset                   # Reset to defaults
```

Available settings:
| Key | Description |
|-----|-------------|
| `defaultTeam` | Default team key for quick commands |
| `defaultProject` | Default project ID |
| `branchStyle` | Branch naming: `feature`, `kebab`, or `plain` |
| `defaultPriority` | Default priority (0-4) for quick issues |

### Shell Completions

```bash
# Bash (add to ~/.bashrc)
eval "$(linear completion bash)"

# Zsh (add to ~/.zshrc)
eval "$(linear completion zsh)"

# Fish (save to ~/.config/fish/completions/linear.fish)
linear completion fish > ~/.config/fish/completions/linear.fish
```

## Security

- API keys are stored securely in your system keychain (macOS Keychain, Windows Credential Vault, or libsecret on Linux)
- No credentials are ever written to plain text files
- No telemetry or data collection

## Requirements

- Node.js 20 or higher
- A Linear account with API access

## License

MIT

## Links

- [Linear](https://linear.app)
- [Linear API Documentation](https://developers.linear.app)
- [Report Issues](https://github.com/brueshi/linear-cli/issues)

