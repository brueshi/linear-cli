# Linear CLI - Agent Reference

> Optimized for coding agents (Claude Code, Cursor, Copilot, etc.). Copy this into your agent's context or CLAUDE.md to enable reliable Linear CLI usage with minimal trial-and-error.

## Rule #1: Discover Before You Act

**Do not guess team keys, status names, or project names.** Run discovery commands first and use the exact values returned.

```bash
# ALWAYS run these first in a new session (use --json for programmatic parsing):
linear auth status --json          # Confirm authenticated + get current user
linear issue list -a me --json     # Get your assigned issues
linear state list -t TEAM --json   # Get EXACT valid status names for a team
linear project list --json         # Get EXACT project names
linear label list -t TEAM --json   # Get existing labels for a team
```

If you don't know the team key, run `linear issue list --json` first — team keys appear in the issue identifiers (e.g., `ENG-123` means team key is `ENG`).

## Rule #2: Always Use --json and --auto

```bash
# --json: structured output, no formatting surprises
# --auto: skip interactive prompts (CRITICAL — agents cannot respond to prompts)

linear agent "description here" --auto --json
linear issue list -a me --json
linear issue update ENG-123 -s "in progress" --json
```

**Every command supports `--json`.** Every mutating command that might prompt supports `--auto`.

## Rule #3: Status Values Are Workspace-Specific

**Do NOT hardcode status names.** They vary by workspace. Always discover first:

```bash
linear state list -t ENG --json
```

Common defaults (but verify):
- `backlog`, `todo`, `in progress`, `in review`, `done`, `cancelled`

Status matching is **case-sensitive and exact**. Use the value exactly as returned by `state list`.

## Quick Command Reference

### Create Issues

```bash
# Best for agents — natural language, auto-extracts team/priority/labels:
linear agent "Fix auth bug in login flow, backend, urgent" --auto --json

# Explicit control:
linear quick "Fix login validation" -t ENG -p 2 --json
linear quick "Sub-task" --parent ENG-123 -t ENG --json

# Full form:
linear issue create -t ENG --title "Title" --description "Details" --json
```

### Read Issues

```bash
linear issue list --json                    # All issues
linear issue list -t ENG --json             # By team
linear issue list -a me --json              # Assigned to me
linear issue list -s "in progress" --json   # By status
linear issue view ENG-123 --json            # Single issue
linear issue children ENG-123 --json        # Sub-issues
linear search "query" --json                # Search
```

### Update Issues

```bash
linear issue update ENG-123 -s "in progress" --json   # Change status
linear issue update ENG-123 -a me --json               # Assign to self
linear issue update ENG-123 --project "Name" --json    # Add to project
linear issue update ENG-123 --add-label "bug" --json   # Add label (auto-creates if missing)
linear issue close ENG-123 --json                      # Close
```

### Batch Operations

```bash
linear batch update ENG-1 ENG-2 ENG-3 -s done --json
```

### Relations

```bash
linear relation add ENG-1 blocks ENG-2 --json
linear relation add ENG-3 blocked-by ENG-4 --json
linear relation add ENG-5 relates-to ENG-6 --json
linear relation add ENG-7 duplicate ENG-8 --json
linear relation list ENG-1 --json
```

### Cycles (Sprints)

```bash
linear cycle list -t ENG --json
linear cycle current -t ENG --json
linear cycle add-issue ENG-123 --json          # Add to active cycle
linear cycle add-issue ENG-123 -c 5 --json     # Add to specific cycle
```

### Projects

```bash
linear project list --json
linear project view "Project Name" --json
linear project create "Name" -t ENG --json
linear project update "Name" -s started --json
```

### Documents

```bash
linear doc list --json
linear doc search "query" --json
linear doc view "Title" --json
linear doc create "Title" -p "Project" -b "Content here" --json
```

### Project Updates

```bash
linear project-update list "Project Name" --json
linear project-update create "Project Name" -b "Status text" -h on-track --json
# Health values: on-track, at-risk, off-track
```

### Labels

```bash
linear label list -t ENG --json
linear label create "name" -t ENG --json
linear label create "name" -t ENG -c "#FF0000" --json
```

### Git Integration

```bash
linear branch ENG-123              # Create and checkout branch
linear branch ENG-123 --copy       # Copy branch name to clipboard
```

### Configuration

```bash
linear config list --json
linear config set defaultTeam ENG
linear config get defaultTeam
```

## Priority Values

| Value | Meaning     |
|-------|-------------|
| 0     | No priority |
| 1     | Urgent      |
| 2     | High        |
| 3     | Medium      |
| 4     | Low         |

## JSON Response Format

All commands return:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Issue not found" } }
```

Always check `success` before accessing `data`.

## Error Recovery

When a command fails, follow this sequence — do not retry the same command blindly:

| Error | Recovery |
|-------|----------|
| Auth failure | Run `linear auth status`. If expired, tell user to run `linear auth login`. |
| Invalid state | Run `linear state list -t TEAM --json` and use an exact match from the results. |
| Team not found | Run `linear issue list --json` to discover valid team keys from issue identifiers. |
| Issue not found | Verify the identifier format (TEAM-NUMBER). Run `linear search "query" --json` to find it. |
| Project not found | Run `linear project list --json` and use the exact name from results. |
| Permission denied | The authenticated user may lack access. Inform the developer. |

## Agent Workflow Patterns

### Starting work on an issue

```bash
linear issue view ENG-123 --json                       # Read context
linear issue update ENG-123 -s "in progress" --json    # Update status
linear branch ENG-123                                   # Create branch
```

### Bug discovered during development

```bash
linear agent "NPE in UserService.getProfile() when profile is null - crashes on line 42 of user_service.py, backend, high priority" --auto --json
```

### Completing work

```bash
linear issue update ENG-123 -s done --json
# or
linear issue close ENG-123 --json
```

### Breaking an issue into sub-tasks

```bash
linear quick "Sub-task 1 description" --parent ENG-123 -t ENG --json
linear quick "Sub-task 2 description" --parent ENG-123 -t ENG --json
```

## Key Principles

1. **Discover, then act.** Never guess workspace-specific values.
2. **Always `--json`.** Human-formatted output is unreliable to parse.
3. **Always `--auto`.** Agents cannot respond to interactive prompts.
4. **Labels auto-create.** Don't pre-check if a label exists — just use it.
5. **Check `success` field.** Don't assume commands succeeded.
6. **Use `linear agent` for creation.** It handles team/priority/label extraction from natural language — less for you to figure out.
7. **One recovery attempt, then stop.** If a command fails twice, report the error to the developer rather than looping.
