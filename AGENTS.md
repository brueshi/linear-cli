# Linear CLI - Agent Instructions

Instructions for AI coding assistants on using the Linear CLI for issue management.

## What is this?

The `linear` command is a CLI tool for managing Linear issues. It allows creating, updating, and viewing issues without leaving the terminal or IDE.

## Authentication

Check if authenticated:
```bash
linear auth status
```

If not authenticated, the user must run `linear auth login` with their Linear API key from https://linear.app/settings/api

## Command Summary

| Command | Purpose |
|---------|---------|
| `linear agent "<text>" --auto` | Create issue from natural language (recommended) |
| `linear quick "<title>"` | Quick issue creation |
| `linear issue list` | List issues |
| `linear issue view <ID>` | View issue details |
| `linear issue update <ID> -s <status>` | Update issue status |
| `linear issue close <ID>` | Close an issue |
| `linear branch <ID>` | Create git branch from issue |
| `linear project list` | List projects |
| `linear project view <name>` | View project details |
| `linear project create <name>` | Create a project |
| `linear label list` | List labels |
| `linear label create <name>` | Create a label |

## Creating Issues

### AI-Powered (Recommended)

Use natural language - the CLI extracts title, team, priority, and labels automatically:

```bash
linear agent "Fix null pointer in UserService.getProfile(), backend team, urgent" --auto
```

The `--auto` flag skips interactive prompts - always use it for programmatic creation.

### With Project Assignment

```bash
linear agent "New feature for dashboard" --auto --project "Q1 Roadmap"
linear quick "API fix" --project "Backend Refactor"
```

### With Labels

```bash
linear quick "Bug title" --label "api,backend,urgent"
linear agent "Auth flow issue" --auto  # AI extracts relevant labels
```

Labels are auto-created if they don't exist.

### Quick Create

```bash
linear quick "Bug title here"
linear quick "Feature request" -t TEAM -p 2
linear quick "API fix" --project "Q1" --label "api,backend"
```

### Flags for `linear agent`

| Flag | Description |
|------|-------------|
| `--auto`, `-a` | Skip confirmation, create immediately |
| `--dry-run`, `-d` | Preview without creating |
| `--team <KEY>`, `-t` | Override team detection |
| `--project <NAME>`, `-p` | Assign to project |
| `--priority <0-4>`, `-P` | Set priority (1=urgent, 4=low) |
| `--assign-to-me`, `-m` | Assign to authenticated user |

## Updating Issues

```bash
# Change status
linear issue update ABC-123 -s "in progress"
linear issue update ABC-123 -s done

# Assign to self
linear issue update ABC-123 -a me

# Move to project
linear issue update ABC-123 --project "Q1 Roadmap"
linear issue update ABC-123 --project none  # Remove from project

# Update labels
linear issue update ABC-123 --label "bug,api"      # Replace all labels
linear issue update ABC-123 --add-label "urgent"   # Add labels

# Close
linear issue close ABC-123
```

## Listing Issues

```bash
linear issue list                    # All recent issues
linear issue list -t TEAM            # Filter by team
linear issue list -s "in progress"   # Filter by status
linear issue list -a me              # Assigned to current user
linear issue list -l 20              # Limit results
```

## Projects

```bash
# List projects
linear project list
linear project list -t TEAM          # Filter by team
linear project list -s started       # Filter by state

# View project details
linear project view "Project Name"

# Create project
linear project create "New Project" -t TEAM
linear project create "Q2 Roadmap" -t TEAM --start-date 2024-04-01
```

## Labels

```bash
# List labels
linear label list
linear label list -t TEAM            # Filter by team

# Create label
linear label create "new-label" -t TEAM
linear label create "bug" -t TEAM -c "#FF0000"
```

## Git Integration

```bash
linear branch ABC-123                # Create and checkout branch
linear branch ABC-123 --copy         # Copy branch name to clipboard
```

## Priority Values

- `0` = No priority
- `1` = Urgent
- `2` = High
- `3` = Medium
- `4` = Low

## Common Statuses

- `backlog`, `todo`, `in progress`, `in review`, `done`, `cancelled`

## Workflow Examples

**Start working on an issue:**
```bash
linear issue update ABC-123 -s "in progress"
linear branch ABC-123
```

**Report a bug found during development:**
```bash
linear agent "Description with file/function context, team, priority" --auto
```

**Complete an issue:**
```bash
linear issue close ABC-123
```

**Check assigned work:**
```bash
linear issue list -a me
```

**Assign issue to project:**
```bash
linear issue update ABC-123 --project "Q1 Roadmap"
```

**List projects:**
```bash
linear project list
```

## Tips

1. Always use `--auto` when creating issues programmatically
2. Include context in descriptions: file names, function names, error messages
3. Mention team names (backend, frontend, etc.) for automatic routing
4. Check `linear auth status` if commands fail unexpectedly
5. Labels are auto-created if they don't exist - just use them
6. Use `--project` flag to assign issues to projects during creation
