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

# AI-powered issue creation (requires Anthropic API key)
linear agent "Fix auth token refresh in Safari, backend team, urgent"

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

### AI-Powered Issue Creation

Create issues using natural language with the `agent` command. The AI extracts structured data from your description and maps it to your Linear workspace.

#### Setup

```bash
# Get an Anthropic API key from https://console.anthropic.com
linear agent-auth <your-anthropic-api-key>
```

#### Usage

```bash
# Basic - AI infers team, priority, and type
linear agent "Fix login button not working on Safari"

# With explicit details
linear agent "Refactor API client to use v2 endpoints, backend team, medium priority, 5 points"

# Auto mode - skip confirmation, create immediately
linear agent "Urgent production bug in auth service" --auto

# Dry run - preview extraction without creating
linear agent "Add dark mode support to dashboard" --dry-run

# Override AI detection
linear agent "Performance issue" --team FE --priority 2

# Assign to yourself
linear agent "Update documentation" --auto --assign-to-me
```

#### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--auto` | `-a` | Skip confirmation, create immediately |
| `--dry-run` | `-d` | Show extracted data without creating issue |
| `--team <key>` | `-t` | Override AI team detection |
| `--project <id>` | `-p` | Override AI project detection |
| `--priority <0-4>` | `-P` | Override AI priority (1=Urgent, 4=Low) |
| `--assign-to-me` | `-m` | Assign the issue to yourself |
| `--no-context` | | Disable workspace context fetching |

#### How It Works

1. Fetches your workspace context (teams, projects, labels)
2. Sends your input to Claude AI with workspace context
3. Extracts: title, description, team, priority, labels, estimate
4. Validates against your workspace
5. Shows confirmation preview (unless `--auto`)
6. Creates the issue in Linear

#### AI Detection Examples

| Input | Extracted |
|-------|-----------|
| "Fix login bug, urgent" | Type: Bug, Priority: Urgent |
| "Add dark mode, frontend" | Type: Feature, Team: Frontend |
| "Refactor auth service, 5 points" | Type: Improvement, Estimate: 5 |
| "ASAP: prod is down" | Priority: Urgent |

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
| `enableAgentContext` | Fetch workspace context for AI agent (default: true) |
| `agentConfirmation` | Show confirmation before AI creates issue (default: true) |
| `agentModel` | Claude model for agent (default: claude-haiku-4-5-20251001) |

### Shell Completions

```bash
# Bash (add to ~/.bashrc)
eval "$(linear completion bash)"

# Zsh (add to ~/.zshrc)
eval "$(linear completion zsh)"

# Fish (save to ~/.config/fish/completions/linear.fish)
linear completion fish > ~/.config/fish/completions/linear.fish
```

## Use Cases

### Quick Bug Capture During Debugging

```bash
# Discover a bug while debugging, capture it without losing context
linear agent "NPE in user service when profile incomplete, backend, urgent" --auto
```

### Git Hook Automation

```bash
# .git/hooks/pre-commit - auto-create issue for new TODOs
TODOS=$(git diff --cached | grep "^+.*TODO:")
if [ -n "$TODOS" ]; then
  linear agent "Code contains new TODOs requiring cleanup" --team DEV --priority 4 --auto
fi
```

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml - create issue on deployment failure
- name: Create failure issue
  if: failure()
  run: |
    linear agent "Deployment failed for ${{ github.sha }}, DevOps team, urgent" --auto
```

### Shell Aliases

```bash
# Add to ~/.zshrc or ~/.bashrc
alias bug='linear agent --auto --priority 1'
alias feature='linear agent --auto --priority 2'
alias task='linear agent --auto --priority 3'

# Usage
bug "Login form validation broken, backend"
feature "Add export to CSV, frontend"
```

## Security

- API keys are stored securely in your system keychain (macOS Keychain, Windows Credential Vault, or libsecret on Linux)
- No credentials are ever written to plain text files
- No telemetry or data collection
- AI input is sanitized to prevent prompt injection

## Requirements

- Node.js 20 or higher
- A Linear account with API access
- (Optional) Anthropic API key for the `agent` command

## License

MIT

## Links

- [Linear](https://linear.app)
- [Linear API Documentation](https://developers.linear.app)
- [Anthropic Console](https://console.anthropic.com) (for agent API key)
- [Report Issues](https://github.com/brueshi/linear-cli/issues)
