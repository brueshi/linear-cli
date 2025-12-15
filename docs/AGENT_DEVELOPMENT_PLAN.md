# Linear CLI Agent - Development Plan

## Overview

This document provides a step-by-step implementation plan for the AI-powered agent feature based on `agent-architecture.md`. The plan is organized into 4 phases spanning approximately 12 days.

---

## Current Codebase Summary

### Existing Infrastructure to Reuse

| Component | Location | Purpose |
|-----------|----------|---------|
| Auth/Keychain | `src/lib/auth.ts` | Secure API key storage via keytar |
| Linear Client | `src/lib/client.ts` | Authenticated Linear SDK wrapper |
| Config Manager | `src/lib/config.ts` | User preferences (JSON file) |
| Error Handling | `src/utils/errors.ts` | Custom error classes, `handleError()` |
| Formatters | `src/utils/format.ts` | Issue formatting, colors, truncation |
| Command Pattern | `src/commands/quick.ts` | Similar single-input command structure |

### New Dependencies Required

```json
{
  "@anthropic-ai/sdk": "^0.39.0"
}
```

---

## Phase 1: Core AI Integration (Days 1-3)

### Goal
Establish Claude API integration with secure key storage and basic prompt engineering.

### Tasks

#### 1.1 Add Anthropic SDK Dependency
```bash
npm install @anthropic-ai/sdk
```

#### 1.2 Create Anthropic Auth Module
**File:** `src/lib/agent/anthropic-auth.ts`

```typescript
// Responsibilities:
// - Store/retrieve Anthropic API key from keychain (reuse keytar pattern)
// - Service name: 'linear-cli-anthropic'
// - Methods: saveApiKey(), getApiKey(), deleteApiKey(), hasApiKey()
```

**Implementation Checklist:**
- [ ] Create `src/lib/agent/` directory
- [ ] Mirror `src/lib/auth.ts` structure for Anthropic key
- [ ] Add `anthropicApiKey` config option to `Config` interface

#### 1.3 Create AI Client Module
**File:** `src/lib/agent/ai-client.ts`

```typescript
// Class: AgentAIClient
// 
// Configuration:
// - Model: claude-haiku-4-5-20251001
// - Max tokens: 1024
// - Temperature: 0.3
// - Timeout: 10s
//
// Methods:
// - constructor(apiKey: string)
// - extractIssueData(input: string, context?: WorkspaceContext): Promise<ExtractedIssueData>
// - parseJsonResponse(content: string): ExtractedIssueData
```

**Implementation Checklist:**
- [ ] Initialize Anthropic client
- [ ] Implement `extractIssueData()` with system + user prompts
- [ ] Handle JSON parsing with fallback error handling
- [ ] Add retry logic for transient failures (1 retry)
- [ ] Handle rate limiting gracefully

#### 1.4 Create Type Definitions
**File:** `src/lib/agent/types.ts`

```typescript
export interface ExtractedIssueData {
  title: string;
  description?: string;
  teamKey?: string;
  teamId?: string;
  projectId?: string;
  priority?: number;          // 0-4
  estimate?: number;          // Story points
  labels?: string[];
  issueType?: 'bug' | 'feature' | 'improvement' | 'task';
  dueDate?: string;           // ISO date
  assigneeId?: string;
}

export interface WorkspaceContext {
  teams: Array<{ id: string; key: string; name: string }>;
  projects: Array<{ id: string; name: string; teamIds: string[] }>;
  labels: Array<{ id: string; name: string }>;
  states: Array<{ id: string; name: string; type: string }>;
  recentIssues: Array<{ id: string; title: string; teamId: string; priority: number }>;
  user: { id: string; email: string; name: string };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  enriched: Partial<ExtractedIssueData>;
}
```

#### 1.5 Create System Prompt
**File:** `src/lib/agent/prompts.ts`

```typescript
export const SYSTEM_PROMPT = `You are an AI assistant that extracts structured Linear issue data from natural language input.

Your task is to parse the user's input and extract the following fields:
- title: Concise issue title (required)
- description: Detailed description if provided
- teamKey: Team identifier (e.g., ATT, FE, OPS)
- priority: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
- estimate: Story points (1-21)
- labels: Relevant labels array
- issueType: bug, feature, improvement, or task
- dueDate: ISO date string if mentioned

Guidelines:
1. Extract only information explicitly stated or clearly implied
2. Use null for fields not mentioned in the input
3. Infer issue type from context (fix/broke=bug, add/new=feature)
4. Detect urgency keywords for priority (ASAP, urgent, critical)
5. Keep titles concise and action-oriented
6. Extract technical terms as potential labels

Return ONLY valid JSON with no additional text.`;

export function buildContextPrompt(context: WorkspaceContext): string {
  // Dynamically build context section with teams, projects, labels
}
```

### Phase 1 Deliverables Checklist
- [ ] `src/lib/agent/anthropic-auth.ts` - Keychain storage
- [ ] `src/lib/agent/ai-client.ts` - Claude API wrapper
- [ ] `src/lib/agent/types.ts` - TypeScript interfaces
- [ ] `src/lib/agent/prompts.ts` - System prompt + context builder
- [ ] Manual testing with 10+ sample inputs
- [ ] Error handling for missing API key, API failures

---

## Phase 2: Context Intelligence (Days 4-6)

### Goal
Fetch workspace context from Linear API and use it to improve AI extraction accuracy.

### Tasks

#### 2.1 Create Context Engine
**File:** `src/lib/agent/context-engine.ts`

```typescript
// Class: ContextEngine
//
// Methods:
// - constructor(linearClient: LinearClient)
// - fetchContext(): Promise<WorkspaceContext>
// - getCachedContext(): WorkspaceContext | null
// - invalidateCache(): void
//
// Fetches (in parallel):
// - Teams (id, key, name)
// - Projects (id, name, team associations)
// - Labels (id, name) - limit to 50 most common
// - Recent issues (last 10) for pattern detection
// - Current user info
//
// Caching:
// - Cache duration: 5 minutes
// - Store in memory (class instance)
```

**Implementation Checklist:**
- [ ] Implement parallel fetching with `Promise.all()`
- [ ] Add 5-minute TTL cache
- [ ] Handle partial failures gracefully
- [ ] Target: < 800ms total fetch time
- [ ] Limit data to essentials (avoid over-fetching)

#### 2.2 Create Issue Parser
**File:** `src/lib/agent/issue-parser.ts`

```typescript
// Responsibilities:
// - Convert AI JSON response to Linear SDK format
// - Map team keys to team IDs
// - Resolve label names to label IDs
// - Apply intelligent defaults
//
// Methods:
// - parseAIResponse(data: ExtractedIssueData, context: WorkspaceContext): LinearIssueInput
// - resolveTeam(teamKey: string, context: WorkspaceContext): string | null
// - resolveLabels(labelNames: string[], context: WorkspaceContext): string[]
// - applyDefaults(data: ExtractedIssueData, config: Config): ExtractedIssueData
```

#### 2.3 Create Validator
**File:** `src/lib/agent/validator.ts`

```typescript
// Responsibilities:
// - Verify extracted IDs exist in workspace
// - Validate priority range (0-4)
// - Check required fields (title required, team recommended)
// - Return validation result with errors/warnings
//
// Methods:
// - validate(data: ExtractedIssueData, context: WorkspaceContext): ValidationResult
// - validateTeam(teamKey: string, context: WorkspaceContext): boolean
// - validatePriority(priority: number): boolean
```

#### 2.4 Enhance Prompt with Context
Update `prompts.ts` to inject workspace context:

```typescript
export function buildUserPrompt(input: string, context: WorkspaceContext): string {
  return `
Available teams:
${context.teams.map(t => `- ${t.key}: ${t.name}`).join('\n')}

Available labels (use these when applicable):
${context.labels.slice(0, 20).map(l => `- ${l.name}`).join('\n')}

Recent issue patterns in this workspace:
${context.recentIssues.slice(0, 5).map(i => `- "${i.title}" (Team: ${i.teamKey}, Priority: ${i.priority})`).join('\n')}

User input to parse:
"${input}"
`;
}
```

### Phase 2 Deliverables Checklist
- [ ] `src/lib/agent/context-engine.ts` - Workspace fetching
- [ ] `src/lib/agent/issue-parser.ts` - AI response parsing
- [ ] `src/lib/agent/validator.ts` - Data validation
- [ ] Enhanced prompt with dynamic context injection
- [ ] Performance testing (context fetch < 800ms)
- [ ] Cache validation testing

---

## Phase 3: Agent Command Implementation (Days 7-9)

### Goal
Build the main `linear agent` command with confirmation flow, flags, and Linear integration.

### Tasks

#### 3.1 Create Agent Command
**File:** `src/commands/agent.ts`

```typescript
import { Command } from 'commander';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { ConfigManager } from '../lib/config.js';
import { AgentAIClient } from '../lib/agent/ai-client.js';
import { ContextEngine } from '../lib/agent/context-engine.js';
import { AnthropicAuthManager } from '../lib/agent/anthropic-auth.js';
import { formatIdentifier } from '../utils/format.js';
import { handleError } from '../utils/errors.js';

export function registerAgentCommand(program: Command): void {
  program
    .command('agent <input>')
    .description('Create issue from natural language input using AI')
    .option('-a, --auto', 'Skip confirmation, create immediately')
    .option('-d, --dry-run', 'Show extraction without creating issue')
    .option('-t, --team <key>', 'Override AI team detection')
    .option('-p, --project <id>', 'Override AI project detection')
    .option('-P, --priority <0-4>', 'Override AI priority detection')
    .option('-m, --assign-to-me', 'Assign issue to authenticated user')
    .option('--no-context', 'Disable workspace context fetching')
    .action(agentAction);
}

async function agentAction(input: string, options: AgentOptions): Promise<void> {
  // Implementation steps:
  // 1. Get Anthropic API key (exit if missing)
  // 2. Get Linear client
  // 3. Fetch workspace context (unless --no-context)
  // 4. Call AI client to extract issue data
  // 5. Apply CLI flag overrides
  // 6. Validate extracted data
  // 7. Show confirmation (unless --auto or --dry-run)
  // 8. Create issue in Linear
  // 9. Display success with URL and branch suggestion
}
```

#### 3.2 Implement Confirmation UI
**File:** `src/lib/agent/confirmation.ts`

```typescript
// Display formatted preview box:
// ┌─────────────────────────────────────────────────┐
// | Title:       Fix auth token refresh in Safari   |
// | Team:        Backend (ATT)                      |
// | Type:        Bug                                |
// | Priority:    Urgent                             |
// | Description: Auth token refresh mechanism...    |
// | Labels:      browser-specific, safari           |
// └─────────────────────────────────────────────────┘
//
// Options: [Y]es, [n]o, [e]dit

export async function showConfirmation(data: ExtractedIssueData): Promise<'create' | 'cancel' | 'edit'>;
export function formatPreviewBox(data: ExtractedIssueData): string;
```

#### 3.3 Implement Edit Flow
When user selects 'edit', allow inline editing of fields:

```typescript
export async function editIssueData(data: ExtractedIssueData, context: WorkspaceContext): Promise<ExtractedIssueData> {
  // Use @inquirer/prompts to let user edit:
  // - Title (input)
  // - Team (select from available)
  // - Priority (select)
  // - Description (editor)
  // - Labels (checkbox)
}
```

#### 3.4 Register Command
**File:** `src/index.ts`

```typescript
import { registerAgentCommand } from './commands/agent.js';

// Add to registration block:
registerAgentCommand(program);
```

#### 3.5 Update Config Interface
**File:** `src/lib/config.ts`

```typescript
export interface Config {
  // ... existing fields ...
  
  // Agent settings
  enableAgentContext?: boolean;   // Default: true
  agentConfirmation?: boolean;    // Default: true
  agentModel?: string;            // Default: claude-haiku-4-5-20251001
}
```

### Phase 3 Deliverables Checklist
- [ ] `src/commands/agent.ts` - Main command handler
- [ ] `src/lib/agent/confirmation.ts` - Confirmation UI
- [ ] Register command in `src/index.ts`
- [ ] Update `Config` interface with agent settings
- [ ] All flags working: `--auto`, `--dry-run`, `--team`, etc.
- [ ] End-to-end testing with real Linear workspace
- [ ] Branch suggestion in output

---

## Phase 4: Polish and Distribution (Days 10-12)

### Goal
Add comprehensive error handling, documentation, and prepare for distribution.

### Tasks

#### 4.1 Add Agent-Specific Errors
**File:** `src/utils/errors.ts`

```typescript
export class AnthropicAuthError extends LinearCliError {
  constructor() {
    super(
      'Anthropic API key not found',
      `Run ${chalk.cyan('linear config set anthropicApiKey <your-key>')} to configure.\nGet your key at: https://console.anthropic.com/settings/keys`,
      1
    );
    this.name = 'AnthropicAuthError';
  }
}

export class AIExtractionError extends LinearCliError {
  constructor(message: string = 'Failed to extract issue data') {
    super(
      message,
      'Try being more specific. Example: linear agent "Fix auth bug, backend team, urgent"',
      1
    );
    this.name = 'AIExtractionError';
  }
}
```

#### 4.2 Add Input Sanitization
**File:** `src/lib/agent/sanitize.ts`

```typescript
// Prevent prompt injection
export function sanitizeInput(input: string): string {
  return input
    .replace(/\bsystem:\b/gi, '')
    .replace(/\bassistant:\b/gi, '')
    .replace(/\buser:\b/gi, '')
    .replace(/<\|.*?\|>/g, '')
    .trim();
}
```

#### 4.3 Performance Optimization
- [ ] Add timing logs (debug mode)
- [ ] Verify total execution < 3 seconds
- [ ] Optimize context fetching queries
- [ ] Test with slow network simulation

#### 4.4 Update README.md
Add agent command section:

```markdown
## AI-Powered Issue Creation

Create issues using natural language with the `agent` command:

### Quick Start

# Basic usage
linear agent "Fix login button on Safari"

# Auto-create without confirmation
linear agent "Urgent auth bug in production" --auto

# Preview without creating
linear agent "Add dark mode support" --dry-run

### Setup

1. Get an Anthropic API key from https://console.anthropic.com
2. Configure the CLI:
   linear config set anthropicApiKey <your-key>

### Flags

| Flag | Description |
|------|-------------|
| --auto, -a | Skip confirmation |
| --dry-run, -d | Preview only |
| --team, -t | Override team |
| --priority, -P | Override priority (0-4) |
| --assign-to-me, -m | Self-assign |
| --no-context | Skip workspace fetch |
```

#### 4.5 Add Help Text
Update command help in `agent.ts`:

```typescript
.addHelpText('after', `
Examples:
  $ linear agent "Fix login bug, urgent, backend team"
  $ linear agent "Add dark mode support" --team FE --priority 2
  $ linear agent "Performance issue in dashboard" --dry-run
  $ linear agent "Critical auth failure" --auto --assign-to-me

The agent uses AI to extract structured issue data from your input.
It analyzes your workspace to suggest teams, labels, and priorities.
`)
```

### Phase 4 Deliverables Checklist
- [ ] Agent-specific error classes
- [ ] Input sanitization
- [ ] Performance benchmarks documented
- [ ] README.md updated with agent section
- [ ] Help text comprehensive
- [ ] All error paths have helpful messages
- [ ] Final build and test

---

## File Structure Summary

After implementation, new files:

```
src/
├── commands/
│   └── agent.ts              # NEW - Main command
├── lib/
│   ├── agent/
│   │   ├── ai-client.ts      # NEW - Claude API wrapper
│   │   ├── anthropic-auth.ts # NEW - API key storage
│   │   ├── confirmation.ts   # NEW - Confirmation UI
│   │   ├── context-engine.ts # NEW - Workspace context
│   │   ├── issue-parser.ts   # NEW - Response parsing
│   │   ├── prompts.ts        # NEW - System prompts
│   │   ├── sanitize.ts       # NEW - Input sanitization
│   │   ├── types.ts          # NEW - TypeScript interfaces
│   │   └── validator.ts      # NEW - Data validation
│   └── ...existing files
└── ...existing files
```

---

## Testing Checklist

### Unit Tests
- [ ] AI client JSON parsing
- [ ] Context engine caching
- [ ] Issue parser mapping
- [ ] Validator rules
- [ ] Input sanitization

### Integration Tests
- [ ] Full agent command flow
- [ ] All flag combinations
- [ ] Error scenarios
- [ ] Cancel/edit flows

### Manual Testing Scenarios
- [ ] "Fix login bug, urgent, backend"
- [ ] "Add dark mode support to dashboard"
- [ ] "Performance issue in API, 5 points"
- [ ] "Refactor auth service, medium priority"
- [ ] Ambiguous input handling
- [ ] Missing API key error
- [ ] Invalid team override
- [ ] Network failure recovery

---

## Performance Benchmarks

| Operation | Target | How to Measure |
|-----------|--------|----------------|
| Context fetch | < 800ms | `console.time()` around `fetchContext()` |
| AI extraction | < 2000ms | Time from API call to parsed response |
| Total command | < 3000ms | `time linear agent "test" --auto` |
| Confirmation render | < 100ms | Time to display preview box |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Claude API rate limits | Implement exponential backoff, cache context |
| Slow AI responses | Set 10s timeout, show "Analyzing..." spinner |
| Incorrect extractions | Confirmation step, edit flow, dry-run mode |
| API key exposure | Store in keychain, never log |
| Prompt injection | Input sanitization before AI call |

---

## Success Criteria

Phase 1:
- [ ] AI extraction works for 20+ test inputs
- [ ] API errors handled gracefully

Phase 2:
- [ ] Context improves team/label inference
- [ ] Cache reduces API calls

Phase 3:
- [ ] Full command works end-to-end
- [ ] All flags implemented

Phase 4:
- [ ] Total execution < 3 seconds
- [ ] Documentation complete
- [ ] Ready for npm publish
