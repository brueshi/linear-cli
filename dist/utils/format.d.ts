import type { Issue, WorkflowState, User } from '@linear/sdk';
/**
 * Format a workflow state with appropriate color
 */
export declare function formatState(state: WorkflowState): string;
/**
 * Format priority with color
 */
export declare function formatPriority(priority: number): string;
/**
 * Format an assignee name
 */
export declare function formatAssignee(assignee: User | undefined | null): string;
/**
 * Format a date for display
 */
export declare function formatDate(date: Date | undefined | null): string;
/**
 * Format an issue identifier (e.g., "ENG-123")
 */
export declare function formatIdentifier(identifier: string): string;
/**
 * Truncate text to a maximum length
 */
export declare function truncate(text: string, maxLength: number): string;
/**
 * Format an issue for list display (single line)
 */
export declare function formatIssueRow(issue: Issue): Promise<string>;
/**
 * Format a detailed issue view
 */
export declare function formatIssueDetails(issue: Issue): Promise<string>;
/**
 * Print a list header
 */
export declare function printListHeader(): void;
