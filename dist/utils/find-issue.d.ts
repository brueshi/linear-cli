import type { LinearClient, Issue } from '@linear/sdk';
/**
 * Find an issue by its identifier (e.g., "ENG-123") or raw ID.
 * Shared utility to avoid duplication across commands.
 */
export declare function findIssueByIdentifier(client: LinearClient, identifier: string): Promise<Issue | null>;
/**
 * Find a project by name or ID
 */
export declare function findProject(client: LinearClient, nameOrId: string): Promise<{
    id: string;
    name: string;
} | null>;
/**
 * Resolve a team by key, returning id and key.
 * Prints available teams and exits if not found.
 */
export declare function resolveTeam(client: LinearClient, teamKey: string): Promise<{
    id: string;
    key: string;
    name: string;
} | null>;
/**
 * Get available team keys for error messages
 */
export declare function getTeamKeys(client: LinearClient): Promise<string[]>;
/**
 * Fuzzy-match a workflow state name against a team's states.
 * Returns the best match or null with available state names for error messages.
 */
export declare function resolveWorkflowState(client: LinearClient, teamId: string, stateName: string): Promise<{
    id: string;
    name: string;
    type: string;
} | {
    error: string;
    available: string[];
}>;
