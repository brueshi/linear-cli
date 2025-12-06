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

## Creating Issues

### AI-Powered (Recommended)

Use natural language - the CLI extracts title, team, priority, and labels automatically:

```bash
linear agent "Fix null pointer in UserService.getProfile(), backend team, urgent" --auto
```

The `--auto` flag skips interactive prompts - always use it for programmatic creation.

### Quick Create

```bash
linear quick "Bug title here"
linear quick "Feature request" -t TEAM -p 2
```

### Flags for `linear agent`

| Flag | Description |
|------|-------------|
| `--auto`, `-a` | Skip confirmation, create immediately |
| `--dry-run`, `-d` | Preview without creating |
| `--team <KEY>`, `-t` | Override team detection |
| `--priority <0-4>`, `-P` | Set priority (1=urgent, 4=low) |
| `--assign-to-me`, `-m` | Assign to authenticated user |

## Updating Issues

```bash
# Change status
linear issue update ABC-123 -s "in progress"
linear issue update ABC-123 -s done

# Assign to self
linear issue update ABC-123 -a me

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

## Tips

1. Always use `--auto` when creating issues programmatically
2. Include context in descriptions: file names, function names, error messages
3. Mention team names (backend, frontend, etc.) for automatic routing
4. Check `linear auth status` if commands fail unexpectedly
