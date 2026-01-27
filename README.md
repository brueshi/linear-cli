# Linear CLI

A command line interface for [Linear](https://linear.app) issue management. Create issues, manage workflows, search, comment, and generate git branches without leaving the terminal.

## Installation

```bash
npm install -g @brueshi/linear-cli
```

### Alternative: Install with Bun

For faster startup times (~5-10x faster), you can use [Bun](https://bun.sh) instead of Node.js:

```bash
# Install globally with Bun
bun install -g @brueshi/linear-cli

# Or run directly from source
git clone https://github.com/brueshi/linear-cli.git
cd linear-cli
bun install
bun run src/index.ts
```

### Standalone Binary (No Runtime Required)

Build a standalone executable with Bun:

```bash
git clone https://github.com/brueshi/linear-cli.git
cd linear-cli
bun install
bun run bun:compile

# Move to your PATH
sudo mv linear-bun /usr/local/bin/linear
```

## Quick Start

```bash
# Authenticate with your Linear API key
linear auth login

# List your issues
linear issue list

# Create an issue quickly
linear quick "Fix the login bug"

# Search for issues
linear search "authentication bug"

# View your personal dashboard
linear me

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

# Project and label management
linear issue update ATT-123 --project "Q1 Roadmap"    # Assign to project
linear issue update ATT-123 --project none            # Remove from project
linear issue update ATT-123 --label "bug,api"         # Set labels
linear issue update ATT-123 --add-label "urgent"      # Add labels
```

### Search

Search across your workspace with full-text search:

```bash
# Basic search
linear search "authentication bug"

# With filters
linear search "login" -t ATT                    # Filter by team
linear search "performance" -s "in progress"   # Filter by state
linear search "api" -a me                       # Filter by assignee
linear search "dashboard" -p "Q1 Roadmap"      # Filter by project
linear search "urgent" -l bug                   # Filter by label

# Include archived issues
linear search "old feature" --include-archived

# Limit results
linear search "bug" --limit 50
```

### Personal Dashboard

View your assigned issues, upcoming due dates, and activity:

```bash
# Full dashboard
linear me

# Filtered views
linear me --assigned    # Only issues assigned to you
linear me --created     # Only issues you created
linear me --due         # Only issues with upcoming due dates
```

### Comments

Manage comments on issues:

```bash
# List comments on an issue
linear comment list ATT-123
linear comment list ATT-123 --include-resolved

# Add a comment
linear comment add ATT-123 "This looks good, shipping tomorrow"
linear comment add ATT-123 --editor    # Open editor for longer comments

# Resolve/unresolve comments
linear comment resolve <comment-id>
linear comment unresolve <comment-id>

# Delete a comment
linear comment delete <comment-id>
linear comment delete <comment-id> -y  # Skip confirmation
```

### Batch Operations

Perform bulk operations on multiple issues:

```bash
# Bulk update status
linear batch update ATT-123 ATT-124 ATT-125 -s "done"

# Bulk update with file input
linear batch update --file issues.txt -s "in progress"

# Bulk update priority
linear batch update ATT-123 ATT-124 -p 2

# Bulk assign
linear batch assign ATT-123 ATT-124 --to me
linear batch assign ATT-123 ATT-124 --to user@example.com

# Bulk close
linear batch close ATT-123 ATT-124 ATT-125

# Add/remove labels in bulk
linear batch update ATT-123 ATT-124 --add-label "urgent,api"
linear batch update ATT-123 ATT-124 --remove-label "backlog"

# Move to project
linear batch update ATT-123 ATT-124 --project "Q1 Roadmap"
```

### Quick Create

Create issues with minimal input:

```bash
linear quick "Fix login bug"                    # Basic
linear quick "Urgent fix" -p 1                  # With priority (1=Urgent)
linear quick "New feature" -t ATT -d "Details"  # With team and description
linear quick "API bug" --project "Q1 Roadmap"   # Assign to project
linear quick "Bug fix" --label "bug,api"        # With labels (auto-created if needed)

# New in v0.0.7
linear quick "Story" -e 5                       # With estimate (story points)
linear quick "Task" -a me                       # Assign to yourself
linear quick "Deadline task" --due 2024-12-31   # With due date
linear quick "Sub-task" --parent ATT-100        # Create as sub-issue
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

# Assign to project
linear agent "New feature" --auto --project "Q1 Roadmap"

# Assign to yourself
linear agent "Update documentation" --auto --assign-to-me
```

#### Sub-issues and Linking

```bash
# Create as sub-issue
linear agent "Implement auth flow" --parent ATT-100

# Link to related issues
linear agent "Related refactor" --relates-to ATT-101 ATT-102
```

#### Templates

Use templates for common issue types:

```bash
# Use built-in templates
linear agent "login validation" --template bug
linear agent "user export" --template feature
linear agent "cleanup code" --template task
linear agent "server down" --template urgent

# Manage templates
linear agent-template list                              # List all templates
linear agent-template save hotfix "HOTFIX: {title}" -P 1  # Create custom template
linear agent-template delete hotfix                     # Delete custom template
linear agent-template reset                             # Reset to defaults
```

#### Batch Mode

Process multiple issues at once:

```bash
# From stdin
echo -e "Fix bug A\nFix bug B\nFix bug C" | linear agent "" --batch --team ATT

# With auto-create
cat issues.txt | linear agent "" --batch --auto

# Continue on errors
cat issues.txt | linear agent "" --batch --continue-on-error
```

#### Enhanced Dry Run

The `--dry-run` flag now shows detailed resolution information:

```
Dry Run - Extracted Issue Data
──────────────────────────────────────────────────

Title:       Fix authentication bug in Safari
Team:        Backend (BE) ✓ resolved
Project:     Q1 Roadmap ✓ resolved
Type:        Bug
Priority:    High
Labels:
  Existing:  backend, api ✓
  To create: safari (will be created)
Assignee:    Joe Developer (you)

Description:
  Users are experiencing login failures...

──────────────────────────────────────────────────
No issue created (dry run mode)
```

#### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--auto` | `-a` | Skip confirmation, create immediately |
| `--dry-run` | `-d` | Show extracted data without creating issue |
| `--team <key>` | `-t` | Override AI team detection |
| `--project <name>` | `-p` | Assign to project by name |
| `--priority <0-4>` | `-P` | Override AI priority (1=Urgent, 4=Low) |
| `--assign-to-me` | `-m` | Assign the issue to yourself |
| `--parent <id>` | | Create as sub-issue of parent |
| `--relates-to <ids>` | | Link to related issues |
| `--template <name>` | | Use a saved template |
| `--batch` | | Process multiple inputs from stdin |
| `--continue-on-error` | | Continue batch on errors |
| `--no-context` | | Disable workspace context fetching |

#### How It Works

1. Fetches your workspace context (teams, projects, labels)
2. Sends your input to Claude AI with workspace context
3. Extracts: title, description, team, priority, labels, estimate
4. Validates against your workspace
5. Shows confirmation preview (unless `--auto`)
6. Creates the issue in Linear
7. Auto-creates any missing labels

#### AI Detection Examples

| Input | Extracted |
|-------|-----------|
| "Fix login bug, urgent" | Type: Bug, Priority: Urgent |
| "Add dark mode, frontend" | Type: Feature, Team: Frontend |
| "Refactor auth service, 5 points" | Type: Improvement, Estimate: 5 |
| "ASAP: prod is down" | Priority: Urgent |

#### Reliability Features (v0.0.7)

- **Automatic retry** with exponential backoff for rate limits and transient errors
- **Parallel batch processing** (3 concurrent by default) for faster bulk operations
- **Label auto-creation** works in batch mode

### AI-Powered Issue Updates

Update issues using natural language:

```bash
# Update status with comment
linear agent-update ATT-123 "Fixed the bug, ready for review"

# Move to in progress
linear agent-update ATT-123 "Starting work now"

# Mark as done with summary
linear agent-update ATT-123 "Completed implementation, tests passing" --auto

# Dry run to preview changes
linear agent-update ATT-123 "Blocked waiting on API team" --dry-run

# JSON output for scripting
linear agent-update ATT-123 "Done" --auto --json
```

The AI interprets natural language to determine:
- Status changes (done, in progress, in review, blocked)
- Comments to add
- Priority changes
- Label additions/removals

### Attachments

Manage issue attachments:

```bash
# List attachments on an issue
linear attachment list ATT-123

# Add a URL attachment
linear attachment add ATT-123 "https://example.com/screenshot.png"
linear attachment add ATT-123 "https://example.com/doc.pdf" --title "Design Doc"

# Remove an attachment
linear attachment remove <attachment-id>
linear attachment remove <attachment-id> -y  # Skip confirmation
```

### PR Description Generation

Generate pull request descriptions from Linear issues:

```bash
# Generate PR title and body
linear pr ATT-123

# JSON output for scripting
linear pr ATT-123 --json

# Just the title
linear pr ATT-123 --title-only

# Just the body
linear pr ATT-123 --body-only

# Copy to clipboard
linear pr ATT-123 --copy
```

The generated PR includes:
- Link to the Linear issue
- Issue description
- Labels and priority
- Standard PR checklist

### Workspace Context (for Coding Agents)

Get workspace context in JSON format for AI coding agents:

```bash
# Full workspace context (teams, projects, labels, states)
linear context

# Filter by team
linear context --team BE

# Specific data only
linear context --teams-only
linear context --projects-only
linear context --labels-only
linear context --states-only

# Force refresh from API
linear context --refresh
```

This command is designed for coding agents (Cursor, Claude Code) to understand your Linear workspace before creating or updating issues programmatically.

### Sync

Force refresh the workspace cache:

```bash
linear sync              # Refresh cache
linear sync -v           # Verbose - show workspace details
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

### Projects

Manage Linear projects:

```bash
# List projects
linear project list                  # List all projects
linear project list -t ATT           # Filter by team
linear project list -s started       # Filter by state (planned, started, paused, completed, canceled)

# View project details
linear project view "Q1 Roadmap"     # View project by name

# Create projects
linear project create "New Project" -t ATT
linear project create "Q2 Roadmap" -t ATT --start-date 2024-04-01 --target-date 2024-06-30
```

### Labels

Manage workspace labels:

```bash
# List labels
linear label list                    # List all labels
linear label list -t ATT             # Filter by team

# Create labels
linear label create "bug" -t ATT                 # Create with team
linear label create "urgent" -t ATT -c "#FF0000" # With custom color
```

Labels are automatically created when referenced in issue creation if they don't exist.

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

### Machine-Readable Output (JSON)

Most commands support `--json` flag for machine-readable output, making the CLI ideal for scripting and integration with coding agents:

```bash
# Issue commands
linear issue list --json
linear issue view ATT-123 --json
linear issue create -t ATT --title "Bug" --json
linear issue update ATT-123 -s done --json

# Comment commands
linear comment list ATT-123 --json
linear comment add ATT-123 "Comment" --json

# Project and label commands
linear project list --json
linear label list --json

# Branch generation
linear branch ATT-123 --json

# Workspace context
linear context --json

# Attachments
linear attachment list ATT-123 --json

# PR generation
linear pr ATT-123 --json

# AI-powered updates
linear agent-update ATT-123 "Done" --auto --json
```

JSON responses follow a consistent structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Or for errors:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Issue not found"
  }
}
```

**Exit Codes:**
- `0`: Success
- `1`: General error
- `2`: Authentication failure
- `3`: Resource not found
- `4`: Rate limited
- `5`: Validation error

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

### Personal Workflow

```bash
# Morning routine - check your dashboard
linear me

# Search for related work
linear search "auth" -a me

# Quick comment on an issue
linear comment add ATT-123 "Started working on this"
```

### Bulk Operations

```bash
# Close all completed sprint issues
linear batch close ATT-100 ATT-101 ATT-102 ATT-103

# Reassign issues during handoff
linear batch assign ATT-200 ATT-201 ATT-202 --to colleague@example.com

# Move issues to new sprint
linear batch update ATT-300 ATT-301 --project "Sprint 42"
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
alias lme='linear me'
alias lsearch='linear search'

# Usage
bug "Login form validation broken, backend"
feature "Add export to CSV, frontend"
lme --due  # Check upcoming deadlines
```

## Security

- API keys are stored securely in your system keychain (macOS Keychain, Windows Credential Vault, or libsecret on Linux)
- No credentials are ever written to plain text files
- No telemetry or data collection
- AI input is sanitized to prevent prompt injection

## Requirements

- Node.js 20+ **or** Bun 1.0+
- A Linear account with API access
- (Optional) Anthropic API key for the `agent` command

### Runtime Comparison

| Runtime | Startup Time | Installation |
|---------|-------------|--------------|
| Node.js | ~200-300ms | `npm install -g` |
| Bun | ~30-50ms | `bun install -g` |
| Standalone | ~20-40ms | Pre-compiled binary |

## Changelog

### v0.0.9

**New Commands:**
- `linear context` - Get workspace context (teams, projects, labels, states) in JSON format for coding agents
- `linear attachment` - Manage issue attachments (list, add URL, remove)
- `linear agent-update` - AI-powered issue updates with natural language
- `linear pr` - Generate PR title and description from Linear issues

**Machine-Readable Output:**
- Added `--json` flag to all major commands for scripting and coding agent integration
- Consistent JSON response structure with success/error format
- Distinct exit codes: 0 (success), 1 (error), 2 (auth failure), 3 (not found), 4 (rate limited), 5 (validation error)

**Commands with JSON Support:**
- `linear issue list/view/create/update/close --json`
- `linear comment list/add --json`
- `linear project list/view --json`
- `linear label list --json`
- `linear branch --json`
- `linear context --json`
- `linear attachment list/add/remove --json`
- `linear pr --json`
- `linear agent-update --json`

**AI-Powered Updates (`agent-update`):**
- Natural language issue updates: "Fixed the bug, ready for review"
- Interprets status changes, comments, priority changes, and label additions
- Supports `--auto`, `--dry-run`, and `--json` flags

**Coding Agent Integration:**
- `linear context` provides workspace state for Cursor/Claude Code agents
- JSON output enables programmatic parsing without regex
- Exit codes allow proper error handling in scripts

### v0.0.7

**New Commands:**
- `linear search` - Full-text search with filters
- `linear me` - Personal dashboard
- `linear comment` - Comment management (list, add, resolve, delete)
- `linear batch` - Bulk operations (update, close, assign)
- `linear sync` - Force refresh workspace cache

**Agent Improvements:**
- Automatic retry with exponential backoff for rate limits and errors
- Parallel batch processing (3x faster for bulk operations)
- Label auto-creation now works in batch mode
- Enhanced dry-run output with resolution details
- Sub-issue support (`--parent`)
- Issue linking (`--relates-to`)
- Template system for common issue types

**Quick Command Enhancements:**
- `--estimate` / `-e` - Story point estimates
- `--assignee` / `-a` - Direct assignment
- `--due` - Due date support
- `--parent` - Sub-issue creation

## License

MIT

## Links

- [Linear](https://linear.app)
- [Linear API Documentation](https://developers.linear.app)
- [Anthropic Console](https://console.anthropic.com) (for agent API key)
- [Report Issues](https://github.com/brueshi/linear-cli/issues)
