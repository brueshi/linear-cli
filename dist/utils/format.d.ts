import type { Issue, WorkflowState, User } from '@linear/sdk';
/**
 * Box drawing characters for panels
 */
declare const BOX: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
    teeRight: string;
    teeLeft: string;
};
/**
 * Status indicators with Unicode symbols
 */
declare const STATUS_ICONS: Record<string, string>;
/**
 * Priority indicators
 */
declare const PRIORITY_ICONS: Record<number, string>;
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
/**
 * Format a comment for display
 */
export declare function formatComment(author: string, createdAt: Date, body: string, resolved?: boolean): string;
/**
 * Format a search result highlight
 */
export declare function formatSearchHighlight(text: string, query: string): string;
/**
 * Format a progress bar
 */
export declare function formatProgressBar(current: number, total: number, width?: number): string;
/**
 * Format a batch summary
 */
export declare function formatBatchSummary(succeeded: number, failed: number, total: number): string;
/**
 * Format a state with icon
 */
export declare function formatStateWithIcon(state: WorkflowState): string;
/**
 * Format priority with icon
 */
export declare function formatPriorityWithIcon(priority: number): string;
/**
 * Create a horizontal divider
 */
export declare function divider(width?: number, char?: string): string;
/**
 * Create a titled section divider
 */
export declare function sectionDivider(title: string, width?: number): string;
/**
 * Format a label with its color (hex color support)
 */
export declare function formatLabel(name: string, hexColor?: string): string;
/**
 * Format a colored label badge
 */
export declare function formatLabelBadge(name: string, hexColor?: string): string;
/**
 * Format a key-value pair with consistent alignment
 */
export declare function formatKeyValue(key: string, value: string, keyWidth?: number): string;
/**
 * Format an info box with a title
 */
export declare function formatInfoBox(title: string, lines: string[], width?: number): string;
/**
 * Format a success message
 */
export declare function formatSuccess(message: string): string;
/**
 * Format an error message
 */
export declare function formatError(message: string): string;
/**
 * Format a warning message
 */
export declare function formatWarning(message: string): string;
/**
 * Format an info message
 */
export declare function formatInfo(message: string): string;
/**
 * Format a list of items with bullets
 */
export declare function formatBulletList(items: string[], indent?: number): string;
/**
 * Format a numbered list
 */
export declare function formatNumberedList(items: string[], indent?: number): string;
/**
 * Format a table row with columns
 */
export declare function formatTableRow(columns: string[], widths: number[]): string;
/**
 * Format a table header with columns
 */
export declare function formatTableHeader(columns: string[], widths: number[]): string;
/**
 * Create a simple spinner-style indicator text
 */
export declare function formatSpinner(text: string): string;
/**
 * Format time ago (e.g., "2 hours ago")
 */
export declare function formatTimeAgo(date: Date | string): string;
/**
 * Export box characters for external use
 */
export { BOX, STATUS_ICONS, PRIORITY_ICONS };
