/**
 * Type definitions for the Linear CLI Agent feature
 */

/**
 * Data extracted from natural language update input by the AI
 */
export interface ExtractedUpdateData {
  /** Comment to add (if any) */
  comment?: string;
  
  /** Status change (workflow state name) */
  statusChange?: string;
  
  /** Priority change: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low */
  priorityChange?: number;
  
  /** Labels to add */
  addLabels?: string[];
  
  /** Labels to remove */
  removeLabels?: string[];
  
  /** Title update (if explicitly requested) */
  titleUpdate?: string;
  
  /** Description to append */
  appendDescription?: string;
  
  /** Assignee change (user name or "me" or "none") */
  assigneeChange?: string;
  
  /** Estimated completion summary (for comment context) */
  summary?: string;
}

/**
 * Data extracted from natural language input by the AI
 */
export interface ExtractedIssueData {
  /** Concise issue title (required) */
  title: string;
  
  /** Detailed description if provided */
  description?: string;
  
  /** Team key identifier (e.g., "ATT", "FE") */
  teamKey?: string;
  
  /** Team ID (resolved from teamKey) */
  teamId?: string;

  /** Project name (for AI extraction) */
  projectName?: string;

  /** Project ID (resolved from projectName) */
  projectId?: string;
  
  /** Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low */
  priority?: number;
  
  /** Story point estimate (1-21) */
  estimate?: number;
  
  /** Label names to apply */
  labels?: string[];
  
  /** Issue type classification */
  issueType?: 'bug' | 'feature' | 'improvement' | 'task';
  
  /** Due date in ISO format */
  dueDate?: string;
  
  /** Assignee user ID */
  assigneeId?: string;
}

/**
 * Workspace context fetched from Linear API
 * Used to improve AI extraction accuracy
 */
export interface WorkspaceContext {
  teams: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  
  projects: Array<{
    id: string;
    name: string;
    description?: string;
    state: string;
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
    teamKey: string;
    priority: number;
    projectName?: string;
  }>;
  
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Result of validating extracted issue data
 */
export interface ValidationResult {
  /** Whether the data is valid for issue creation */
  valid: boolean;
  
  /** Critical errors that prevent issue creation */
  errors: string[];
  
  /** Non-critical warnings */
  warnings: string[];
  
  /** Enriched/corrected data */
  enriched: Partial<ExtractedIssueData>;
}

/**
 * Options passed to the agent command
 */
export interface AgentOptions {
  /** Skip confirmation, create immediately */
  auto?: boolean;
  
  /** Show extraction without creating issue */
  dryRun?: boolean;
  
  /** Override AI team detection */
  team?: string;
  
  /** Override AI project detection */
  project?: string;
  
  /** Override AI priority detection (0-4) */
  priority?: string;
  
  /** Assign issue to authenticated user */
  assignToMe?: boolean;
  
  /** Disable workspace context fetching */
  context?: boolean;
}

/**
 * Configuration options for the AI client
 */
export interface AIClientConfig {
  /** Anthropic API key */
  apiKey: string;

  /** Model to use (default: claude-haiku-4-5-20251001) */
  model?: string;

  /** Maximum tokens in response */
  maxTokens?: number;

  /** Temperature for response generation */
  temperature?: number;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum retry attempts for transient failures (default: 3) */
  maxRetries?: number;

  /** Base delay between retries in milliseconds (default: 1000) */
  retryBaseDelay?: number;
}
