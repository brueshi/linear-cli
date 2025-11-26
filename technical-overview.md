# Linear CLI

**Technical Specification Document**

Version 1.0 | November 2025

---

## Executive Summary

Linear CLI is a command line interface tool designed to streamline issue management workflows for developers using Linear. The tool enables rapid issue creation, updates, and queries directly from the terminal, eliminating context switching to browser interfaces during development.

Built with TypeScript and Node.js, Linear CLI leverages Linear's official SDK and GraphQL API to provide a robust, type safe developer experience. The tool prioritizes security through macOS Keychain integration for credential storage and emphasizes performance through efficient API usage patterns.

## Project Goals

- Reduce context switching by enabling full issue management from the terminal
- Provide secure credential storage using native OS keychain services
- Integrate with existing development workflows including git branch naming conventions
- Deliver a fast, responsive CLI experience with minimal startup overhead
- Support both interactive and scriptable usage patterns for CI/CD integration

## Architecture Overview

### Directory Structure

```
linear-cli/
├── src/
│   ├── index.ts          # Application entry point and CLI initialization
│   ├── commands/         # Individual command handlers (auth, issue, team, etc.)
│   ├── lib/              # Core modules (API client, authentication, configuration)
│   └── utils/            # Shared utilities (formatting, git integration, prompts)
├── package.json
└── tsconfig.json
```

### Core Components

| Component | Responsibility |
|-----------|----------------|
| **AuthManager** | Handles API key storage/retrieval via macOS Keychain using keytar |
| **LinearClient** | Wrapper around @linear/sdk providing typed API operations |
| **ConfigManager** | Manages user preferences, default team/project, and templates |
| **GitIntegration** | Parses branch names, links commits to issues, suggests branches |

## Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| Runtime | Node.js 20+ | JavaScript runtime with ES modules |
| Language | TypeScript 5.x | Type safety and developer experience |
| CLI Framework | Commander.js | Command parsing, help generation, subcommands |
| API Client | @linear/sdk | Official Linear SDK with full type definitions |
| Secure Storage | keytar | Native OS keychain (macOS Keychain) |
| Prompts | @inquirer/prompts | Interactive command line prompts |
| Output Styling | chalk | Terminal colors and formatting |

## Command Reference

### Authentication

| Command | Description |
|---------|-------------|
| `linear auth login` | Store API key securely in keychain |
| `linear auth logout` | Remove stored credentials |
| `linear auth status` | Display current authentication state |

### Issue Management

| Command | Description |
|---------|-------------|
| `linear issue create` | Create new issue (interactive or with flags) |
| `linear issue list` | List issues with filtering options |
| `linear issue view <id>` | Display issue details |
| `linear issue update <id>` | Modify issue properties |
| `linear issue close <id>` | Mark issue as completed |

### Quick Actions

| Command | Description |
|---------|-------------|
| `linear quick <title>` | Rapid issue creation with minimal input |
| `linear branch` | Generate git branch name from current/specified issue |

### Configuration

| Command | Description |
|---------|-------------|
| `linear config set <key> <value>` | Set configuration option |
| `linear config get <key>` | Retrieve configuration value |
| `linear config list` | Display all configuration |

## Development Phases

### Phase 1: Foundation (Week 1)

1. Project scaffolding with TypeScript and ES modules configuration
2. Authentication module with keytar integration for secure API key storage
3. Linear SDK client wrapper with error handling
4. Basic CLI structure with commander.js

### Phase 2: Core Commands (Week 2)

1. Issue CRUD operations (create, read, update, delete)
2. Interactive prompts for issue creation workflow
3. List filtering by status, assignee, team, and project
4. Formatted output with chalk for terminal display

### Phase 3: Enhanced Features (Week 3)

1. Git integration for branch name parsing and generation
2. Quick capture command for zero friction issue creation
3. Configuration system for default team, project, and preferences
4. Issue templates for common workflows (bug, feature, task)

### Phase 4: Polish (Week 4)

1. Comprehensive error handling and user friendly messages
2. Shell completions for bash, zsh, and fish
3. Documentation and help text refinement
4. NPM package preparation and publishing workflow

## Security Considerations

- **Credential Storage:** API keys stored exclusively in macOS Keychain via keytar, never in plain text configuration files
- **Token Validation:** API key validity verified on each session start with graceful handling of expired or revoked tokens
- **Minimal Permissions:** Tool requests only necessary Linear API scopes for issue management operations
- **No Telemetry:** No usage data collection or external analytics; all operations are local to the user's machine

## Success Metrics

- Issue creation time under 5 seconds for quick capture mode
- CLI startup time under 500ms for responsive user experience
- Zero credential leakage through logs, error messages, or configuration files
- Complete offline graceful degradation with clear error messaging

## Future Considerations

- **Cycle Management:** Commands for viewing and managing Linear cycles and sprints
- **Project Views:** Roadmap and project progress visualization in terminal
- **Webhooks:** Local webhook receiver for real time notifications
- **Multi Workspace:** Support for managing multiple Linear workspaces
- **TUI Mode:** Optional terminal UI for interactive issue browsing