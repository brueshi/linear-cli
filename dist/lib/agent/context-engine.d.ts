import type { LinearClient } from '@linear/sdk';
import type { WorkspaceContext } from './types.js';
/**
 * Context Engine for fetching and caching workspace data from Linear API
 *
 * Provides workspace context to improve AI extraction accuracy by
 * informing the model about available teams, projects, labels, etc.
 */
export declare class ContextEngine {
    private client;
    private cache;
    private cacheTimestamp;
    constructor(client: LinearClient);
    /**
     * Fetch workspace context from Linear API
     * Returns cached data if still valid, otherwise fetches fresh data
     */
    fetchContext(): Promise<WorkspaceContext>;
    /**
     * Get cached context without fetching
     * Returns null if no cache exists or cache is expired
     */
    getCachedContext(): WorkspaceContext | null;
    /**
     * Invalidate the cache, forcing fresh fetch on next request
     */
    invalidateCache(): void;
    /**
     * Fetch all teams in the workspace
     */
    private fetchTeams;
    /**
     * Fetch all projects in the workspace
     */
    private fetchProjects;
    /**
     * Fetch common labels in the workspace
     */
    private fetchLabels;
    /**
     * Fetch workflow states for a specific team
     */
    private fetchTeamStates;
    /**
     * Fetch recent issues for pattern detection
     */
    private fetchRecentIssues;
    /**
     * Find a team by key (case-insensitive)
     */
    findTeamByKey(key: string): WorkspaceContext['teams'][0] | undefined;
    /**
     * Find a team by name (case-insensitive partial match)
     */
    findTeamByName(name: string): WorkspaceContext['teams'][0] | undefined;
    /**
     * Find labels by names (case-insensitive)
     */
    findLabelsByNames(names: string[]): WorkspaceContext['labels'];
    /**
     * Find a project by name (case-insensitive partial match)
     */
    findProjectByName(name: string): WorkspaceContext['projects'][0] | undefined;
    /**
     * Get the default team based on recent issue patterns
     * Returns the most frequently used team in recent issues
     */
    getDefaultTeam(): WorkspaceContext['teams'][0] | undefined;
}
