import { execSync } from 'child_process';

/**
 * Git integration utilities for Linear CLI
 */

/**
 * Check if the current directory is inside a git repository
 */
export function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current git branch name
 */
export function getCurrentBranch(): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' });
    return branch.trim();
  } catch {
    return null;
  }
}

/**
 * Parse a Linear issue identifier from a branch name
 * Supports common formats:
 * - feature/ENG-123-description
 * - ENG-123-description
 * - ENG-123/description
 * - fix/ENG-123
 */
export function parseIssueFromBranch(branchName: string): string | null {
  // Match pattern: TEAM-NUMBER (e.g., ENG-123, PROJ-456)
  const match = branchName.match(/([A-Z]+-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Get the issue identifier from the current branch
 */
export function getIssueFromCurrentBranch(): string | null {
  const branch = getCurrentBranch();
  if (!branch) return null;
  return parseIssueFromBranch(branch);
}

/**
 * Branch naming styles
 */
export type BranchStyle = 'feature' | 'kebab' | 'plain';

/**
 * Generate a git branch name from an issue
 */
export function generateBranchName(
  identifier: string,
  title: string,
  style: BranchStyle = 'feature'
): string {
  // Sanitize title for branch name
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '')         // Trim leading/trailing hyphens
    .slice(0, 50);                 // Limit length

  const id = identifier.toLowerCase();

  switch (style) {
    case 'feature':
      return `feature/${id}-${sanitized}`;
    case 'kebab':
      return `${id}-${sanitized}`;
    case 'plain':
      return `${id}/${sanitized}`;
    default:
      return `feature/${id}-${sanitized}`;
  }
}

/**
 * Create a new git branch and optionally switch to it
 */
export function createBranch(branchName: string, checkout: boolean = true): void {
  if (checkout) {
    execSync(`git checkout -b "${branchName}"`, { stdio: 'inherit' });
  } else {
    execSync(`git branch "${branchName}"`, { stdio: 'inherit' });
  }
}

/**
 * Check if a branch already exists
 */
export function branchExists(branchName: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branchName}`);
    return true;
  } catch {
    return false;
  }
}

