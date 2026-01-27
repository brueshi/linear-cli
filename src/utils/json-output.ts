/**
 * JSON output utilities for machine-readable CLI responses
 * 
 * Enables coding agents (Cursor, Claude Code) to parse CLI output programmatically
 * without needing regex or text parsing.
 */

import type { Issue, WorkflowState, User, Project, IssueLabel, Comment, Attachment } from '@linear/sdk';

// ─────────────────────────────────────────────────────────────────
// Exit Codes
// ─────────────────────────────────────────────────────────────────

export const ExitCodes = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  AUTH_FAILURE: 2,
  NOT_FOUND: 3,
  RATE_LIMITED: 4,
  VALIDATION_ERROR: 5,
} as const;

export type ExitCode = (typeof ExitCodes)[keyof typeof ExitCodes];

// ─────────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────────

/**
 * Standard JSON response wrapper
 */
export interface JsonResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Issue data in JSON format
 */
export interface IssueJson {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  priority: number;
  priorityLabel: string;
  estimate?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  status: {
    id: string;
    name: string;
    type: string;
  };
  team: {
    id: string;
    key: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  labels: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Comment data in JSON format
 */
export interface CommentJson {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  resolvedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Project data in JSON format
 */
export interface ProjectJson {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  startDate?: string;
  targetDate?: string;
  url: string;
  teams: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  issueCount: number;
  completedIssueCount: number;
}

/**
 * Label data in JSON format
 */
export interface LabelJson {
  id: string;
  name: string;
  description?: string;
  color: string;
  isGroup: boolean;
  parent?: {
    id: string;
    name: string;
  };
}

/**
 * Attachment data in JSON format
 */
export interface AttachmentJson {
  id: string;
  title: string;
  url: string;
  subtitle?: string;
  sourceType?: string;
  createdAt: string;
}

/**
 * Team data in JSON format
 */
export interface TeamJson {
  id: string;
  key: string;
  name: string;
  description?: string;
}

/**
 * Workflow state data in JSON format
 */
export interface StateJson {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
}

/**
 * Workspace context for coding agents
 */
export interface WorkspaceContextJson {
  user: {
    id: string;
    name: string;
    email: string;
  };
  teams: TeamJson[];
  projects: Array<{
    id: string;
    name: string;
    teamIds: string[];
  }>;
  labels: Array<{
    id: string;
    name: string;
  }>;
  states: StateJson[];
}

/**
 * Branch/PR data in JSON format
 */
export interface BranchJson {
  name: string;
  issue: {
    id: string;
    identifier: string;
    title: string;
    url: string;
  };
}

/**
 * PR description data in JSON format
 */
export interface PrDescriptionJson {
  title: string;
  body: string;
  issue: IssueJson;
}

// ─────────────────────────────────────────────────────────────────
// Global JSON Mode State
// ─────────────────────────────────────────────────────────────────

let jsonModeEnabled = false;

/**
 * Enable JSON output mode
 */
export function enableJsonMode(): void {
  jsonModeEnabled = true;
}

/**
 * Check if JSON mode is enabled
 */
export function isJsonMode(): boolean {
  return jsonModeEnabled;
}

// ─────────────────────────────────────────────────────────────────
// Output Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Output success response in JSON format
 */
export function outputJson<T>(data: T): void {
  const response: JsonResponse<T> = {
    success: true,
    data,
  };
  console.log(JSON.stringify(response, null, 2));
}

/**
 * Output error response in JSON format
 */
export function outputJsonError(code: string, message: string): void {
  const response: JsonResponse<never> = {
    success: false,
    error: { code, message },
  };
  console.log(JSON.stringify(response, null, 2));
}

/**
 * Output raw JSON (for simple data)
 */
export function outputRawJson<T>(data: T): void {
  console.log(JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────────────────────────
// Conversion Functions
// ─────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

/**
 * Convert Linear SDK Issue to JSON format
 */
export async function issueToJson(issue: Issue): Promise<IssueJson> {
  const [state, team, project, labels, assignee, creator] = await Promise.all([
    issue.state,
    issue.team,
    issue.project,
    issue.labels(),
    issue.assignee,
    issue.creator,
  ]);

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description || undefined,
    url: issue.url,
    priority: issue.priority,
    priorityLabel: PRIORITY_LABELS[issue.priority] || 'Unknown',
    estimate: issue.estimate || undefined,
    dueDate: issue.dueDate || undefined,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    status: state ? {
      id: state.id,
      name: state.name,
      type: state.type,
    } : {
      id: '',
      name: 'Unknown',
      type: 'unknown',
    },
    team: team ? {
      id: team.id,
      key: team.key,
      name: team.name,
    } : {
      id: '',
      key: '',
      name: 'Unknown',
    },
    project: project ? {
      id: project.id,
      name: project.name,
    } : undefined,
    labels: labels.nodes.map(l => ({
      id: l.id,
      name: l.name,
      color: l.color,
    })),
    assignee: assignee ? {
      id: assignee.id,
      name: assignee.name || assignee.displayName || '',
      email: assignee.email || '',
    } : undefined,
    creator: creator ? {
      id: creator.id,
      name: creator.name || creator.displayName || '',
      email: creator.email || '',
    } : undefined,
  };
}

/**
 * Convert Linear SDK Comment to JSON format
 */
export async function commentToJson(comment: Comment): Promise<CommentJson> {
  const user = await comment.user;

  return {
    id: comment.id,
    body: comment.body || '',
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    resolved: !!comment.resolvedAt,
    resolvedAt: comment.resolvedAt?.toISOString(),
    user: user ? {
      id: user.id,
      name: user.name || user.displayName || '',
      email: user.email || '',
    } : {
      id: '',
      name: 'Unknown',
      email: '',
    },
  };
}

/**
 * Convert Linear SDK Project to JSON format
 */
export async function projectToJson(project: Project): Promise<ProjectJson> {
  const [teams, issues] = await Promise.all([
    project.teams(),
    project.issues({ first: 100 }),
  ]);

  const completedCount = issues.nodes.filter(i => i.completedAt).length;

  return {
    id: project.id,
    name: project.name,
    description: project.description || undefined,
    state: project.state,
    progress: project.progress,
    startDate: project.startDate || undefined,
    targetDate: project.targetDate || undefined,
    url: project.url,
    teams: teams.nodes.map(t => ({
      id: t.id,
      key: t.key,
      name: t.name,
    })),
    issueCount: issues.nodes.length,
    completedIssueCount: completedCount,
  };
}

/**
 * Convert Linear SDK IssueLabel to JSON format
 */
export function labelToJson(label: IssueLabel): LabelJson {
  return {
    id: label.id,
    name: label.name,
    description: label.description || undefined,
    color: label.color,
    isGroup: label.isGroup || false,
    parent: undefined, // Would need async fetch if needed
  };
}

/**
 * Convert Linear SDK Attachment to JSON format
 */
export function attachmentToJson(attachment: Attachment): AttachmentJson {
  return {
    id: attachment.id,
    title: attachment.title,
    url: attachment.url,
    subtitle: attachment.subtitle || undefined,
    sourceType: attachment.sourceType || undefined,
    createdAt: attachment.createdAt.toISOString(),
  };
}

/**
 * Convert Linear SDK WorkflowState to JSON format
 */
export function stateToJson(state: WorkflowState): StateJson {
  return {
    id: state.id,
    name: state.name,
    type: state.type,
    color: state.color,
    position: state.position,
  };
}

/**
 * Convert Linear SDK User to minimal JSON format
 */
export function userToJson(user: User): { id: string; name: string; email: string } {
  return {
    id: user.id,
    name: user.name || user.displayName || '',
    email: user.email || '',
  };
}
