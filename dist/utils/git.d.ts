/**
 * Git integration utilities for Linear CLI
 */
/**
 * Check if the current directory is inside a git repository
 */
export declare function isGitRepo(): boolean;
/**
 * Get the current git branch name
 */
export declare function getCurrentBranch(): string | null;
/**
 * Parse a Linear issue identifier from a branch name
 * Supports common formats:
 * - feature/ENG-123-description
 * - ENG-123-description
 * - ENG-123/description
 * - fix/ENG-123
 */
export declare function parseIssueFromBranch(branchName: string): string | null;
/**
 * Get the issue identifier from the current branch
 */
export declare function getIssueFromCurrentBranch(): string | null;
/**
 * Branch naming styles
 */
export type BranchStyle = 'feature' | 'kebab' | 'plain';
/**
 * Generate a git branch name from an issue
 */
export declare function generateBranchName(identifier: string, title: string, style?: BranchStyle): string;
/**
 * Create a new git branch and optionally switch to it
 */
export declare function createBranch(branchName: string, checkout?: boolean): void;
/**
 * Check if a branch already exists
 */
export declare function branchExists(branchName: string): boolean;
