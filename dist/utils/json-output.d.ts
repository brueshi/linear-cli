/**
 * JSON output utilities for machine-readable CLI responses
 *
 * Enables coding agents (Cursor, Claude Code) to parse CLI output programmatically
 * without needing regex or text parsing.
 */
import type { Issue, WorkflowState, User, Project, IssueLabel, Comment, Attachment, Cycle, Document, IssueRelation, ProjectUpdate, IssueSearchResult, DocumentSearchResult } from '@linear/sdk';
export declare const ExitCodes: {
    readonly SUCCESS: 0;
    readonly GENERAL_ERROR: 1;
    readonly AUTH_FAILURE: 2;
    readonly NOT_FOUND: 3;
    readonly RATE_LIMITED: 4;
    readonly VALIDATION_ERROR: 5;
};
export type ExitCode = (typeof ExitCodes)[keyof typeof ExitCodes];
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
    comments?: CommentJson[];
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
/**
 * Enable JSON output mode
 */
export declare function enableJsonMode(): void;
/**
 * Check if JSON mode is enabled
 */
export declare function isJsonMode(): boolean;
/**
 * Output success response in JSON format
 */
export declare function outputJson<T>(data: T): void;
/**
 * Output error response in JSON format
 */
export declare function outputJsonError(code: string, message: string): void;
/**
 * Output raw JSON (for simple data)
 */
export declare function outputRawJson<T>(data: T): void;
/**
 * Options for issueToJson conversion
 */
export interface IssueToJsonOptions {
    includeComments?: boolean;
    comments?: Comment[];
}
/**
 * Convert Linear SDK Issue to JSON format
 */
export declare function issueToJson(issue: Issue, options?: IssueToJsonOptions): Promise<IssueJson>;
/**
 * Convert Linear SDK IssueSearchResult to JSON format.
 * IssueSearchResult has the same shape as Issue but is a different class.
 */
export declare function issueSearchResultToJson(issue: IssueSearchResult): Promise<IssueJson>;
/**
 * Convert Linear SDK DocumentSearchResult to DocumentJson format.
 */
export declare function documentSearchResultToJson(doc: DocumentSearchResult): Promise<DocumentJson>;
/**
 * Convert Linear SDK Comment to JSON format
 */
export declare function commentToJson(comment: Comment): Promise<CommentJson>;
/**
 * Convert Linear SDK Project to JSON format
 */
export declare function projectToJson(project: Project): Promise<ProjectJson>;
/**
 * Convert Linear SDK IssueLabel to JSON format
 */
export declare function labelToJson(label: IssueLabel): LabelJson;
/**
 * Convert Linear SDK Attachment to JSON format
 */
export declare function attachmentToJson(attachment: Attachment): AttachmentJson;
/**
 * Convert Linear SDK WorkflowState to JSON format
 */
export declare function stateToJson(state: WorkflowState): StateJson;
/**
 * Convert Linear SDK User to minimal JSON format
 */
export declare function userToJson(user: User): {
    id: string;
    name: string;
    email: string;
};
/**
 * Cycle data in JSON format
 */
export interface CycleJson {
    id: string;
    number: number;
    name?: string;
    description?: string;
    startsAt: string;
    endsAt: string;
    completedAt?: string;
    progress: number;
    issueCountHistory: number[];
    completedIssueCountHistory: number[];
    isActive: boolean;
    team: {
        id: string;
        key: string;
        name: string;
    };
}
/**
 * Convert Linear SDK Cycle to JSON format
 */
export declare function cycleToJson(cycle: Cycle): Promise<CycleJson>;
/**
 * Document data in JSON format
 */
export interface DocumentJson {
    id: string;
    title: string;
    content?: string;
    icon?: string;
    color?: string;
    slugId: string;
    createdAt: string;
    updatedAt: string;
    url: string;
    project?: {
        id: string;
        name: string;
    };
    creator?: {
        id: string;
        name: string;
        email: string;
    };
}
/**
 * Convert Linear SDK Document to JSON format
 */
export declare function documentToJson(doc: Document): Promise<DocumentJson>;
/**
 * Issue relation data in JSON format
 */
export interface RelationJson {
    id: string;
    type: string;
    issue: {
        id: string;
        identifier: string;
        title: string;
        url: string;
    };
    relatedIssue: {
        id: string;
        identifier: string;
        title: string;
        url: string;
    };
}
/**
 * Convert Linear SDK IssueRelation to JSON format
 */
export declare function relationToJson(relation: IssueRelation): Promise<RelationJson>;
/**
 * Project update data in JSON format
 */
export interface ProjectUpdateJson {
    id: string;
    body: string;
    health: string;
    createdAt: string;
    updatedAt: string;
    url: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
    project: {
        id: string;
        name: string;
    };
}
/**
 * Convert Linear SDK ProjectUpdate to JSON format
 */
export declare function projectUpdateToJson(update: ProjectUpdate): Promise<ProjectUpdateJson>;
