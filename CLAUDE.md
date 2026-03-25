# Linear CLI - AI Instructions

This file provides instructions for AI assistants (Cursor, Claude Code, etc.) on how to use the Linear CLI to manage issues during development.

## Overview

The `linear` CLI allows you to create, update, and manage Linear issues directly from the terminal. Use it to track work, report bugs, and update issue status without leaving your IDE.

## Prerequisites

Before using, ensure the CLI is authenticated:

```bash
linear auth status
```

If not authenticated, the developer needs to either:
- Run `linear auth login` with their Linear API key, or
- Set the `LINEAR_API_KEY` environment variable (useful for headless/CI environments)

For AI-powered issue creation (`linear agent`), the Anthropic API key must also be set via `linear agent-auth <key>` or the `ANTHROPIC_API_KEY` environment variable.

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

### Cycles (Sprints)

```bash
# List cycles for a team
linear cycle list -t TEAM

# View current active cycle and its issues
linear cycle current -t TEAM

# Add/remove issues from cycles
linear cycle add-issue ABC-123           # Add to active cycle
linear cycle add-issue ABC-123 -c 5      # Add to cycle #5
linear cycle remove-issue ABC-123
```

### Issue Relations

```bash
# Link issues
linear relation add ENG-1 blocks ENG-2
linear relation add ENG-3 blocked-by ENG-4
linear relation add ENG-5 relates-to ENG-6
linear relation add ENG-7 duplicate ENG-8

# List relations for an issue
linear relation list ENG-1

# Remove a relation by ID
linear relation remove <relation-id>
```

### Sub-issues

```bash
# Create a sub-issue
linear issue create --parent ABC-123 --title "Sub-task" -t TEAM
linear quick "Sub-task title" --parent ABC-123

# List sub-issues
linear issue children ABC-123
```

### Workflow States

```bash
# List all workflow states for a team
linear state list -t TEAM

# List states for all teams
linear state list
```

### Documents

```bash
# List documents
linear doc list
linear doc list -p "Project Name"    # Filter by project

# View a document
linear doc view "Document Title"

# Create a document
linear doc create "Spec: New Feature" -p "Project" -b "# Overview\n..."
linear doc create "Design Doc" -e     # Open editor for content

# Search documents
linear doc search "authentication"
```

### Project Updates (Status Updates)

```bash
# List status updates for a project
linear project-update list "Project Name"

# Create a status update
linear project-update create "Project Name" -b "On track. Completed auth module." -h on-track
linear project-update create "Project Name" -b "Blocked on API." -h at-risk
linear project-update create "Project Name" -e -h off-track   # Open editor
```

### Project Management

```bash
# Update a project
linear project update "Project Name" -d "New description"
linear project update "Project Name" -s started
linear project update "Project Name" --target-date 2026-06-01
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

## JSON Output (Agent-Friendly)

All commands support `--json` for machine-readable output. This is critical for AI agents:

```bash
# Every command supports --json
linear issue list -t TEAM --json
linear search "auth bug" --json
linear me --json
linear cycle current -t TEAM --json
linear relation list ENG-123 --json
linear state list -t TEAM --json
linear doc list --json
linear project-update list "Project" --json
linear batch update ENG-1 ENG-2 -s done --json
```

JSON output always follows this structure:
```json
{
  "success": true,
  "data": { ... }
}
```

On error:
```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Issue not found" }
}
```

## Best Practices for AI Assistants

1. **Use `--auto` flag** when creating issues programmatically to skip interactive prompts
2. **Use `--json` flag** when parsing output programmatically - all commands support it
3. **Be specific in descriptions** - include file names, function names, and error messages
4. **Include team context** - mention "backend", "frontend", "mobile" etc. for better routing
5. **Update status proactively** - mark issues as "in progress" when starting and "done" when completing
6. **Check auth status first** if commands fail - suggest `linear auth login` if needed
7. **Labels are auto-created** - don't worry if a label doesn't exist, it will be created automatically
8. **Use projects for organization** - assign issues to relevant projects when the context is clear
9. **Check valid states** before setting them with `linear state list -t TEAM --json`
10. **Link related issues** when discovering duplicates or blockers with `linear relation add`

## Error Handling

If a command fails:
- Check authentication: `linear auth status`
- Verify the issue ID exists: `linear issue view ID`
- Check team key is valid: `linear issue list -t TEAM`
- Check valid workflow states: `linear state list -t TEAM`
- Error messages include available options when a state/team/label doesn't match

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

**Developer says: "What's in the current sprint?"**
```bash
linear cycle current -t TEAM
```

**Developer says: "This issue blocks ENG-456"**
```bash
linear relation add ENG-123 blocks ENG-456
```

**Developer says: "Break this into sub-tasks"**
```bash
linear quick "Sub-task 1" --parent ENG-123 -t TEAM
linear quick "Sub-task 2" --parent ENG-123 -t TEAM
linear issue children ENG-123
```

**Developer says: "Post a project status update"**
```bash
linear project-update create "Project Name" -b "Completed auth module. On track for deadline." -h on-track
```

**Developer says: "Write a spec document"**
```bash
linear doc create "Spec: Feature X" -p "Project Name" -b "# Overview\n\nThis document..."
```

**Developer says: "What states can I set?"**
```bash
linear state list -t TEAM
```
