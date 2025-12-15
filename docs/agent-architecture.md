# Linear CLI - AI Agent Architecture

**Technical Specification for Natural Language Issue Creation**

Version 1.0 | December 2025

---

## Executive Summary

The Linear CLI Agent feature extends the existing Linear CLI with AI-powered natural language issue creation. Unlike conversational interfaces, this implementation follows a single-shot command pattern optimized for developer workflows, particularly those using AI-enhanced IDEs like Cursor and Claude Code.

The agent command accepts freeform natural language input and intelligently extracts structured Linear issue data through Claude API integration. It prioritizes speed, scriptability, and composability while maintaining the Unix philosophy of doing one thing well.

**Target Performance:**
- Total execution time: < 3 seconds (AI extraction + Linear creation)
- Single command input to issue creation
- Zero required follow-up interactions for well-formed inputs
- Optional confirmation step with sub-second display

## Design Philosophy

### Core Principles

1. **Speed Over Hand-Holding**: Single command execution, no multi-turn conversations
2. **Scriptable First**: Works in git hooks, CI/CD pipelines, shell aliases
3. **Flow State Preservation**: Minimal context switching from code to CLI
4. **Complementary to AI IDEs**: Provides quick capture, not conversational AI
5. **Intelligent Defaults**: Leverages workspace context for smart field inference
6. **Unix Philosophy**: Composable, pipeable, automation-friendly

### Why Not Conversational?

Developers using Cursor or Claude Code already have:
- Superior conversational AI with full codebase context
- Natural language interfaces built into their editor
- Multi-turn conversation capabilities for complex planning

The CLI agent serves a different purpose: lightning-fast issue capture without interrupting flow state. When an AI agent in Cursor calls `linear agent`, it needs immediate execution, not a conversation with another AI.

## Command Interface

### Basic Usage

```bash
# Minimal input, AI infers everything possible
linear agent "Fix login button on Safari"

# Explicit fields for precision
linear agent "Refactor API client to use new v2 endpoints, backend team, medium priority, 3 point estimate"

# Auto mode, skip confirmation
linear agent "Urgent production bug in auth service" --auto

# Dry run to see extraction without creating
linear agent "Add dark mode support" --dry-run
```

### Command Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--auto` | `-a` | Skip confirmation, create immediately | false |
| `--dry-run` | `-d` | Show extracted data without creating | false |
| `--team` | `-t` | Override AI team detection | null |
| `--project` | `-p` | Override AI project detection | null |
| `--priority` | `-P` | Override AI priority detection (0-4) | null |
| `--assign-to-me` | `-m` | Assign issue to authenticated user | false |
| `--no-context` | | Disable workspace context fetching | false |

### Confirmation Flow

**Default Mode (with confirmation):**
```
$ linear agent "Fix auth token refresh in Safari, urgent, backend"

Analyzing...

┌─────────────────────────────────────────────────┐
│ Title:       Fix auth token refresh in Safari   │
│ Team:        Backend (ATT)                      │
│ Type:        Bug                                │
│ Priority:    Urgent                             │
│ Description: Auth token refresh mechanism       │
│              failing in Safari browser          │
│ Labels:      browser-specific, safari           │
└─────────────────────────────────────────────────┘

Create this issue? [Y/n/e] 
  Y = Yes, create now
  n = Cancel
  e = Edit fields interactively

> y

✓ Created: ATT-247 - Fix auth token refresh in Safari
  https://linear.app/workspace/issue/ATT-247
  Branch: git checkout -b feature/att-247-fix-auth-token-refresh
```

**Auto Mode (immediate creation):**
```
$ linear agent "Add rate limiting to API endpoints" --auto

✓ Created: ATT-248 - Add rate limiting to API endpoints
  https://linear.app/workspace/issue/ATT-248
```

**Dry Run Mode:**
```
$ linear agent "Performance issue in dashboard" --dry-run

Extracted Data:
{
  "title": "Performance issue in dashboard",
  "teamKey": "FE",
  "issueType": "bug",
  "priority": 2,
  "description": "Dashboard experiencing performance degradation",
  "labels": ["performance", "frontend"],
  "estimate": null
}

(No issue created)
```

## Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────┐
│                    linear agent                          │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│              Command Handler (agent.ts)                  │
│  • Parse CLI arguments                                   │
│  • Orchestrate pipeline                                  │
│  • Handle confirmation flow                              │
└────────────┬─────────────────────────────────────────────┘
             │
             ├─────────────────────┬────────────────────────┐
             ▼                     ▼                        ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Context Engine     │  │   AI Client      │  │  Linear Client   │
│                     │  │                  │  │                  │
│  • Fetch workspace  │  │  • Claude Haiku  │  │  • @linear/sdk   │
│  • Recent issues    │  │  • Prompt eng.   │  │  • Issue create  │
│  • Teams/projects   │  │  • Parse JSON    │  │  • Validation    │
│  • Labels/states    │  │  • Error handle  │  │  • Error handle  │
└─────────────────────┘  └──────────────────┘  └──────────────────┘
             │                     │                        │
             └─────────────────────┴────────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │   Issue Created  │
                        │   ATT-247        │
                        └──────────────────┘
```

### Data Flow

```
1. User Input
   ↓
2. Fetch Workspace Context (parallel)
   - Teams, projects, labels, states
   - Recent issues for pattern detection
   - User preferences from config
   ↓
3. AI Extraction (Claude Haiku 4.5)
   - Parse natural language
   - Extract structured fields
   - Apply intelligent defaults
   ↓
4. Validation & Enrichment
   - Verify team/project IDs exist
   - Map priority strings to numbers
   - Resolve ambiguous references
   ↓
5. Confirmation (unless --auto)
   - Display formatted preview
   - Accept/reject/edit
   ↓
6. Linear API Call
   - Create issue via @linear/sdk
   - Return issue ID and URL
   ↓
7. Output & Cleanup
   - Display success message
   - Suggest git branch
   - Exit cleanly
```

## Technical Implementation

### Directory Structure

```
src/
├── commands/
│   └── agent.ts                 # Main command entry point
├── lib/
│   ├── agent/
│   │   ├── ai-client.ts         # Claude API wrapper
│   │   ├── context-engine.ts    # Workspace context fetching
│   │   ├── issue-parser.ts      # AI response → Linear format
│   │   └── validator.ts         # Field validation & enrichment
│   ├── prompts/
│   │   ├── system-prompt.ts     # Base system prompt
│   │   └── context-builder.ts   # Dynamic context injection
│   └── types/
│       └── agent.ts             # TypeScript interfaces
├── config/
│   └── anthropic.ts             # API configuration
└── utils/
    └── confirmation.ts          # Confirmation UI logic
```

### Core Modules

#### 1. AI Client (`ai-client.ts`)

**Responsibilities:**
- Manage Anthropic API client initialization
- Handle API key retrieval from keychain
- Execute Claude API calls with retry logic
- Parse JSON responses from Claude
- Handle rate limiting and errors

**Key Methods:**
```typescript
class AgentAIClient {
  async extractIssueData(
    input: string,
    context: WorkspaceContext
  ): Promise<ExtractedIssueData>
  
  async refineExtraction(
    previous: ExtractedIssueData,
    feedback: string
  ): Promise<ExtractedIssueData>
}
```

**API Configuration:**
- Model: `claude-haiku-4-5-20251001` (Claude Haiku 4.5)
- Max tokens: 1024 (sufficient for structured output)
- Temperature: 0.3 (consistent, predictable extraction)
- Timeout: 10 seconds

#### 2. Context Engine (`context-engine.ts`)

**Responsibilities:**
- Fetch workspace structure from Linear API
- Cache context data for session reuse
- Build AI prompt context from workspace
- Detect usage patterns for smart defaults

**Fetched Context:**
```typescript
interface WorkspaceContext {
  teams: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    teamIds: string[];
  }>;
  labels: Array<{
    id: string;
    name: string;
  }>;
  states: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  recentIssues: Array<{
    id: string;
    title: string;
    teamId: string;
    priority: number;
  }>;
  user: {
    id: string;
    email: string;
    name: string;
  };
}
```

**Performance Optimization:**
- Parallel API requests for all context data
- Context fetching time budget: < 800ms
- Cache context for 5 minutes in memory
- `--no-context` flag to skip for maximum speed

#### 3. Issue Parser (`issue-parser.ts`)

**Responsibilities:**
- Convert AI JSON response to Linear SDK format
- Map natural language fields to Linear IDs
- Apply fallback defaults for missing fields
- Enrich data with intelligent inference

**Extraction Format:**
```typescript
interface ExtractedIssueData {
  title: string;
  description?: string;
  teamKey?: string;
  teamId?: string;
  projectId?: string;
  priority?: number;
  estimate?: number;
  labels?: string[];
  issueType?: 'bug' | 'feature' | 'improvement' | 'task';
  dueDate?: string;
  assigneeId?: string;
}
```

**Intelligent Defaults:**
- Priority: Infer from urgency language (ASAP, urgent, critical → 1-2)
- Issue Type: Infer from keywords (fix, broke → bug; add, new → feature)
- Team: Use default from config or most common in recent issues
- Labels: Extract from domain keywords (auth, api, frontend, etc.)

#### 4. Validator (`validator.ts`)

**Responsibilities:**
- Verify extracted IDs exist in workspace
- Resolve team keys to IDs
- Validate priority ranges (0-4)
- Check required fields (title, team)
- Provide helpful error messages

**Validation Rules:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  enriched: Partial<ExtractedIssueData>;
}
```

### Prompt Engineering

#### System Prompt Structure

```typescript
const SYSTEM_PROMPT = `You are an AI assistant that extracts structured Linear issue data from natural language input.

Your task is to parse the user's input and extract the following fields:
- title: Concise issue title (required)
- description: Detailed description if provided
- teamKey: Team identifier (ATT, FE, etc.)
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
6. Extract technical terms as labels

Return ONLY valid JSON with no additional text.`;
```

#### Context Injection

Dynamic context added to each request:

```typescript
const contextPrompt = `
Available teams:
${teams.map(t => `- ${t.key}: ${t.name}`).join('\n')}

Available projects:
${projects.map(p => `- ${p.name}`).join('\n')}

Common labels:
${labels.slice(0, 20).map(l => `- ${l.name}`).join('\n')}

Recent issue patterns:
${recentIssues.slice(0, 5).map(i => 
  `- ${i.title} (Team: ${i.team.key}, Priority: ${i.priority})`
).join('\n')}

User preferences:
- Default team: ${config.defaultTeam || 'none'}
- Default priority: ${config.defaultPriority || 'none'}
`;
```

#### Example Prompts & Responses

**Input:** "Fix auth token refresh in Safari, urgent, backend"

**AI Response:**
```json
{
  "title": "Fix auth token refresh in Safari",
  "description": "Auth token refresh mechanism failing in Safari browser",
  "teamKey": "ATT",
  "priority": 1,
  "issueType": "bug",
  "labels": ["browser-specific", "safari", "auth"]
}
```

**Input:** "Add rate limiting to API endpoints, should be 100 req/min, backend team, 5 point estimate"

**AI Response:**
```json
{
  "title": "Add rate limiting to API endpoints",
  "description": "Implement rate limiting at 100 requests per minute for API endpoints",
  "teamKey": "ATT",
  "priority": 2,
  "estimate": 5,
  "issueType": "feature",
  "labels": ["api", "backend"]
}
```

## Integration with Existing CLI

### Reuse Existing Infrastructure

The agent command leverages existing Linear CLI components:

```typescript
// Reuse existing auth
import { AuthManager } from '../lib/auth';

// Reuse existing Linear client
import { LinearClient } from '../lib/linear-client';

// Reuse existing config
import { ConfigManager } from '../lib/config';

// Reuse existing formatters
import { formatIssue, formatSuccess } from '../utils/formatters';
```

### New Configuration Keys

Add to existing config system:

```typescript
interface AgentConfig {
  anthropicApiKey?: string;      // Stored in keychain
  enableAgentContext?: boolean;   // Default: true
  agentConfirmation?: boolean;    // Default: true
  agentModel?: string;            // Default: claude-haiku-4-5-20251001
}
```

Configuration commands:

```bash
# Set Anthropic API key
linear config set anthropicApiKey <key>

# Disable context fetching for faster execution
linear config set enableAgentContext false

# Auto-create without confirmation
linear config set agentConfirmation false
```

### Command Registration

Add to existing Commander.js setup in `index.ts`:

```typescript
program
  .command('agent <input>')
  .description('Create issue from natural language input')
  .option('-a, --auto', 'Skip confirmation, create immediately')
  .option('-d, --dry-run', 'Show extraction without creating')
  .option('-t, --team <key>', 'Override team detection')
  .option('-p, --project <id>', 'Override project detection')
  .option('-P, --priority <0-4>', 'Override priority detection')
  .option('-m, --assign-to-me', 'Assign to authenticated user')
  .option('--no-context', 'Disable workspace context fetching')
  .action(agentCommand);
```

## Development Phases

### Phase 1: Core AI Integration (Days 1-3)

**Deliverables:**
- AI client module with Claude Haiku 4.5 integration
- Anthropic API key storage in keychain (reuse keytar)
- Basic prompt engineering for field extraction
- JSON response parsing and validation
- Error handling for API failures

**Testing:**
- Unit tests for AI client
- Mock API responses for consistent testing
- Validation of extracted data structures
- Error scenario handling

**Success Criteria:**
- Successfully extract structured data from 20+ test inputs
- Handle API errors gracefully
- Parse JSON responses reliably
- Extraction latency < 2 seconds

### Phase 2: Context Intelligence (Days 4-6)

**Deliverables:**
- Context engine for workspace data fetching
- Parallel API requests for performance
- Context caching mechanism
- Dynamic prompt generation with workspace context
- Smart defaults based on patterns

**Testing:**
- Context fetching performance tests
- Cache invalidation logic
- Pattern detection accuracy
- Default inference verification

**Success Criteria:**
- Context fetching completes in < 800ms
- Cache reduces redundant API calls
- AI makes accurate team/project inferences 80%+ of time
- Intelligent defaults applied correctly

### Phase 3: Agent Command Implementation (Days 7-9)

**Deliverables:**
- Main agent command handler
- Confirmation UI with formatted preview
- Flag handling (auto, dry-run, overrides)
- Integration with existing Linear client
- Issue creation workflow
- Success output with URL and branch suggestion

**Testing:**
- End-to-end command testing
- Confirmation flow testing
- Flag combinations testing
- Integration with Linear API

**Success Criteria:**
- Complete pipeline from input to issue creation
- Confirmation shows all extracted data
- Flags work as documented
- Issues created correctly in Linear

### Phase 4: Polish & Distribution (Days 10-12)

**Deliverables:**
- Comprehensive error messages
- Edge case handling
- Performance optimization
- Documentation updates (README, help text)
- Example usage gallery
- Package updates for npm distribution

**Testing:**
- Full regression testing
- Performance benchmarking
- User acceptance testing
- Documentation review

**Success Criteria:**
- Total execution time < 3 seconds
- Clear error messages for all failure modes
- Complete documentation
- Ready for npm publish

## Use Case Examples

### Use Case 1: Quick Bug Capture During Debugging

**Scenario:** Developer discovers bug while debugging, needs to track it without losing context.

```bash
$ linear agent "NPE in user service when profile incomplete, backend, urgent" --auto
✓ Created: ATT-301 - NullPointerException in user service
```

**Time saved:** 2 minutes (vs opening browser, filling form)

### Use Case 2: Feature Request from Code Review

**Scenario:** During PR review, identify needed refactoring.

```bash
$ linear agent "Refactor UserService to use dependency injection, backend, medium priority, 5 points"
┌────────────────────────────────────────────────┐
│ Title:    Refactor UserService to use DI      │
│ Team:     Backend (ATT)                        │
│ Priority: Medium                               │
│ Estimate: 5 points                             │
└────────────────────────────────────────────────┘
Create? [Y/n/e] > y
✓ Created: ATT-302 - Refactor UserService to use dependency injection
```

**Integration:** Link in PR comment, reference in commit message

### Use Case 3: Git Hook Automation

**Scenario:** Auto-create tracking issue when TODO comments added.

```bash
# .git/hooks/pre-commit
#!/bin/bash
TODOS=$(git diff --cached | grep "^+.*TODO:")
if [ -n "$TODOS" ]; then
  linear agent "Code contains new TODOs requiring cleanup" --team DEV --priority 4 --auto
fi
```

**Benefit:** Automatic technical debt tracking

### Use Case 4: CI/CD Pipeline Integration

**Scenario:** Create issue when deployment fails.

```bash
# .github/workflows/deploy.yml
- name: Create failure issue
  if: failure()
  run: |
    linear agent "Deployment failed for ${{ github.sha }}, DevOps team, urgent" --auto
```

**Benefit:** Automatic incident tracking

### Use Case 5: AI IDE Integration

**Scenario:** Cursor/Claude Code agent creates Linear issue during code generation.

```typescript
// Claude Code tool call
await exec(`linear agent "Implement user authentication with OAuth2, backend team, high priority, 8 points" --auto`);
```

**Benefit:** Seamless AI workflow, no conversation overhead

### Use Case 6: Shell Alias for Common Patterns

```bash
# .zshrc
alias bug='linear agent --auto --priority 1 --team ATT'
alias feature='linear agent --auto --priority 2 --team ATT'
alias task='linear agent --auto --priority 3 --team DEV'

# Usage
$ bug "Login form validation broken"
✓ Created: ATT-303 - Login form validation broken
```

**Benefit:** Team-specific shortcuts

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI Extraction Latency | < 2s | Time from API call to parsed response |
| Context Fetching | < 800ms | Parallel API requests complete |
| Total Command Execution | < 3s | Input to success message |
| Confirmation Display | < 100ms | Data formatted and rendered |
| Linear Issue Creation | < 500ms | SDK call to issue created |

## Security Considerations

### API Key Storage

- Anthropic API key stored in macOS Keychain via keytar (same as Linear key)
- Service name: `linear-cli-anthropic`
- Account name: User's system username
- Never logged, printed, or stored in plain text

### Prompt Injection Prevention

```typescript
// Sanitize user input before sending to AI
function sanitizeInput(input: string): string {
  // Remove potential prompt injection patterns
  return input
    .replace(/\bsystem:\b/gi, '')
    .replace(/\bassistant:\b/gi, '')
    .replace(/\b<\|.*?\|>\b/g, '')
    .trim();
}
```

### Validation Before Creation

- All AI-extracted data validated against Linear API schema
- Team/project IDs verified to exist in workspace
- User cannot create issues in teams they don't have access to
- Description and title sanitized for XSS (handled by Linear SDK)

### Rate Limiting

- Claude API: Built-in rate limiting via SDK
- Linear API: Respect rate limit headers
- Fail gracefully with retry suggestions

## Error Handling

### AI Extraction Failures

```
Error: Unable to extract issue data from input
Suggestion: Try being more specific about the team or issue type
Example: linear agent "Fix auth bug, backend team, urgent"
```

### Authentication Failures

```
Error: Anthropic API key not found
Run: linear config set anthropicApiKey <your-key>
Get your key at: https://console.anthropic.com/settings/keys
```

### Linear API Failures

```
Error: Failed to create issue in Linear
Reason: Team 'XYZ' not found in workspace
Available teams: ATT (Backend), FE (Frontend), OPS (DevOps)
```

### Network Failures

```
Error: Network request failed
- Check internet connection
- Verify Linear API status: https://status.linear.app
- Retry with: linear agent "<your input>" --auto
```

## Testing Strategy

### Unit Tests

```typescript
describe('AgentAIClient', () => {
  test('extracts basic issue data', async () => {
    const result = await client.extractIssueData(
      'Fix login bug, urgent, backend',
      mockContext
    );
    expect(result.title).toBe('Fix login bug');
    expect(result.priority).toBe(1);
    expect(result.teamKey).toBe('ATT');
  });
});
```

### Integration Tests

```typescript
describe('agent command', () => {
  test('creates issue from natural language', async () => {
    const result = await runCommand([
      'agent',
      'Test issue for backend team',
      '--auto'
    ]);
    expect(result.stdout).toContain('Created: ATT-');
  });
});
```

### Performance Tests

```typescript
describe('performance', () => {
  test('completes in under 3 seconds', async () => {
    const start = Date.now();
    await runCommand(['agent', 'Test issue', '--auto']);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000);
  });
});
```

### Test Coverage Targets

- Unit test coverage: > 85%
- Integration test coverage: > 70%
- All error paths tested
- All flag combinations tested

## Future Enhancements

### Phase 5: Advanced Features (Future)

**Batch Creation:**
```bash
linear agent --batch << EOF
Fix auth bug, urgent, backend
Add dark mode, feature, frontend, 5 points
Update API docs, task, docs team
EOF
```

**Template Support:**
```bash
# Save template
linear agent template save bug "Fix {issue}, {team} team, urgent"

# Use template
linear agent template bug --issue "login form" --team backend
```

**Issue Linking:**
```bash
linear agent "Duplicate of ATT-123" --relates-to ATT-123
linear agent "Blocks deployment" --blocks ATT-124
```

**AI Suggestions:**
```bash
linear agent suggest
# AI analyzes recent commits and suggests issues to create
```

### Phase 6: Advanced Intelligence (Future)

**Learning from Patterns:**
- Analyze user's historical issue creation patterns
- Suggest team based on keywords in title
- Auto-apply labels based on past similar issues

**Code Context Integration:**
```bash
linear agent "Fix this function" --context $(git diff HEAD~1)
# AI extracts issue details from code diff
```

## Success Metrics

### Quantitative Metrics

- Adoption rate: % of CLI users who try agent command
- Usage frequency: Average invocations per active user per week
- Success rate: % of commands resulting in issue creation
- Time saved: Average seconds saved vs manual creation
- AI accuracy: % of extractions requiring no manual correction

### Qualitative Metrics

- User satisfaction scores
- Feature request alignment with usage patterns
- Integration frequency in CI/CD pipelines
- Adoption in team workflows

## Documentation Requirements

### README Updates

Add agent command section with:
- Quick start examples
- Flag reference
- Common usage patterns
- Troubleshooting guide

### Help Text

```bash
$ linear agent --help

Create Linear issues from natural language input

USAGE
  $ linear agent <input> [flags]

ARGUMENTS
  input  Natural language description of the issue to create

FLAGS
  -a, --auto              Skip confirmation, create immediately
  -d, --dry-run           Show extraction without creating issue
  -t, --team <key>        Override AI team detection
  -p, --project <id>      Override AI project detection  
  -P, --priority <0-4>    Override AI priority detection
  -m, --assign-to-me      Assign issue to authenticated user
  --no-context            Disable workspace context fetching

EXAMPLES
  $ linear agent "Fix login bug, urgent, backend team"
  $ linear agent "Add dark mode support" --team FE --priority 2
  $ linear agent "Performance issue in dashboard" --dry-run
  $ linear agent "Critical auth failure" --auto --assign-to-me

DESCRIPTION
  The agent command uses AI to extract structured issue data from
  natural language input. It analyzes your workspace context to make
  intelligent suggestions for team, priority, labels, and other fields.
  
  By default, shows a confirmation preview before creating the issue.
  Use --auto to skip confirmation for scripting and automation.
```

### Example Gallery

Create `examples/agent-examples.md` with 20+ realistic examples showing:
- Different issue types (bug, feature, task)
- Various priority levels
- Team specifications
- Estimate handling
- Label extraction
- Description generation

## Conclusion

The Linear CLI Agent feature provides a fast, intelligent, and scriptable interface for issue creation that complements modern AI-enhanced developer workflows. By prioritizing single-shot execution over conversational interfaces, it respects developer flow state and integrates seamlessly into existing automation pipelines.

The architecture leverages Claude Haiku 4.5 for cost-effective, high-quality extraction while maintaining the Unix philosophy of composable tools. With proper prompt engineering and workspace context awareness, the agent delivers accurate field extraction while remaining fast enough for interactive use.

This feature positions Linear CLI as an essential tool for teams using AI-enhanced development environments, providing the missing link between natural language intent and structured issue tracking.