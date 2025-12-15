# Linear CLI - AI Instructions

This file provides instructions for AI assistants (Cursor, Claude Code, etc.) on how to use the Linear CLI to manage issues during development.

## Overview

The `linear` CLI allows you to create, update, and manage Linear issues directly from the terminal. Use it to track work, report bugs, and update issue status without leaving your IDE.

## Prerequisites

Before using, ensure the CLI is authenticated:

```bash
linear auth status
```

If not authenticated, the developer needs to run `linear auth login` with their Linear API key.

For AI-powered issue creation (`linear agent`), the Anthropic API key must also be set via `linear agent-auth <key>`.

## Quick Reference

### Creating Issues

**Fastest - AI-powered (recommended for AI assistants):**
```bash
linear agent "Fix authentication bug in Safari browser, backend team, urgent" --auto
```

**Quick create with minimal input:**
```bash
linear quick "Fix login validation"
linear quick "Add dark mode" -p 2 -t FE
linear quick "API endpoint fix" --project "Q1 Roadmap" --label "api,backend"
```

**Full control:**
```bash
linear issue create -t TEAM --title "Issue title" --description "Details"
```

### Updating Issues

```bash
# Update status
linear issue update ABC-123 -s "in progress"
linear issue update ABC-123 -s done

# Assign to current user
linear issue update ABC-123 -a me

# Move to a project
linear issue update ABC-123 --project "Q1 Roadmap"

# Add labels
linear issue update ABC-123 --add-label "api,urgent"

# Close an issue
linear issue close ABC-123
```

### Viewing Issues

```bash
# List issues
linear issue list
linear issue list -t TEAM          # Filter by team
linear issue list -s "in progress" # Filter by status
linear issue list -a me            # Assigned to current user

# View specific issue
linear issue view ABC-123
```

### Projects

```bash
# List projects
linear project list
linear project list -t TEAM        # Filter by team
linear project list -s started     # Filter by state

# View project details
linear project view "Project Name"

# Create a project
linear project create "New Project" -t TEAM
```

### Labels

```bash
# List labels
linear label list
linear label list -t TEAM          # Filter by team

# Create a label
linear label create "new-label" -t TEAM
linear label create "bug" -t TEAM -c "#FF0000"
```

### Git Branches

```bash
linear branch ABC-123              # Create and checkout branch
linear branch ABC-123 --copy       # Copy branch name to clipboard
```

## Common Workflows for AI Assistants

### When Starting Work on an Issue

If the developer mentions an issue ID (e.g., "I'm working on ABC-123"):
```bash
linear issue view ABC-123
linear issue update ABC-123 -s "in progress"
linear branch ABC-123
```

### When a Bug is Discovered

Create an issue immediately with context:
```bash
linear agent "NPE when user profile is null in UserService.getProfile(), backend, high priority" --auto
```

### When Work is Completed

```bash
linear issue update ABC-123 -s done
# or
linear issue close ABC-123
```

### When Asked to Create an Issue

Use the `agent` command for natural language input - it automatically extracts title, team, priority, and labels:
```bash
linear agent "Add pagination to the users API endpoint, backend team, medium priority, 3 story points" --auto
```

Key flags:
- `--auto` / `-a`: Skip confirmation prompt, create immediately
- `--dry-run` / `-d`: Preview extraction without creating
- `--team TEAM` / `-t`: Override detected team
- `--project NAME` / `-p`: Assign to a project
- `--priority 0-4` / `-P`: Override priority (1=urgent, 4=low)
- `--assign-to-me` / `-m`: Assign to the authenticated user

### When Asked to Assign to a Project

```bash
# During creation
linear agent "New feature" --auto --project "Q1 Roadmap"
linear quick "Bug fix" --project "Backend Refactor"

# Update existing issue
linear issue update ABC-123 --project "Q1 Roadmap"
```

### When Asked to Add Labels

```bash
# During creation - labels are auto-created if they don't exist
linear quick "API bug" --label "api,backend,urgent"
linear agent "Fix auth flow" --auto  # AI extracts relevant labels

# Update existing issue
linear issue update ABC-123 --add-label "priority,api"
linear issue update ABC-123 --label "bug,backend"  # Replace all labels
```

## Priority Levels

| Value | Meaning |
|-------|---------|
| 0     | No priority |
| 1     | Urgent |
| 2     | High |
| 3     | Medium |
| 4     | Low |

## Status Values

Common status values (vary by workspace):
- `backlog`
- `todo`
- `in progress`
- `in review`
- `done`
- `cancelled`

## Configuration

Check or set defaults:
```bash
linear config list                  # Show all settings
linear config set defaultTeam TEAM  # Set default team
linear config get defaultTeam       # Get current default
```

## Best Practices for AI Assistants

1. **Use `--auto` flag** when creating issues programmatically to skip interactive prompts
2. **Be specific in descriptions** - include file names, function names, and error messages
3. **Include team context** - mention "backend", "frontend", "mobile" etc. for better routing
4. **Update status proactively** - mark issues as "in progress" when starting and "done" when completing
5. **Check auth status first** if commands fail - suggest `linear auth login` if needed
6. **Labels are auto-created** - don't worry if a label doesn't exist, it will be created automatically
7. **Use projects for organization** - assign issues to relevant projects when the context is clear

## Error Handling

If a command fails:
- Check authentication: `linear auth status`
- Verify the issue ID exists: `linear issue view ID`
- Check team key is valid: `linear issue list -t TEAM`

## Examples by Scenario

**Developer says: "Create an issue for this bug"**
```bash
linear agent "Description of the bug with relevant context" --auto
```

**Developer says: "I'm done with ABC-123"**
```bash
linear issue close ABC-123
```

**Developer says: "What issues are assigned to me?"**
```bash
linear issue list -a me
```

**Developer says: "Start working on ABC-123"**
```bash
linear issue update ABC-123 -s "in progress"
linear branch ABC-123
```

**Developer says: "Create a branch for this issue"**
```bash
linear branch ABC-123
```

**Developer says: "Add this to the Q1 Roadmap project"**
```bash
linear issue update ABC-123 --project "Q1 Roadmap"
```

**Developer says: "What projects do we have?"**
```bash
linear project list
```

**Developer says: "Create a bug label"**
```bash
linear label create "bug" -t TEAM -c "#FF0000"
```
