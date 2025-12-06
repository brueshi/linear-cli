import type { LinearClient } from '@linear/sdk';
import type { WorkspaceContext } from './types.js';

/** Cache duration in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

/** Maximum number of recent issues to fetch */
const MAX_RECENT_ISSUES = 10;

/** Maximum number of labels to include in context */
const MAX_LABELS = 50;

/**
 * Context Engine for fetching and caching workspace data from Linear API
 * 
 * Provides workspace context to improve AI extraction accuracy by
 * informing the model about available teams, projects, labels, etc.
 */
export class ContextEngine {
  private client: LinearClient;
  private cache: WorkspaceContext | null = null;
  private cacheTimestamp: number = 0;

  constructor(client: LinearClient) {
    this.client = client;
  }

  /**
   * Fetch workspace context from Linear API
   * Returns cached data if still valid, otherwise fetches fresh data
   */
  async fetchContext(): Promise<WorkspaceContext> {
    // Return cached context if still valid
    if (this.cache && Date.now() - this.cacheTimestamp < CACHE_TTL) {
      return this.cache;
    }

    // Fetch all context data in parallel for performance
    const [
      teamsResult,
      projectsResult,
      labelsResult,
      issuesResult,
      viewer,
    ] = await Promise.all([
      this.fetchTeams(),
      this.fetchProjects(),
      this.fetchLabels(),
      this.fetchRecentIssues(),
      this.client.viewer,
    ]);

    // Build context object
    const context: WorkspaceContext = {
      teams: teamsResult,
      projects: projectsResult,
      labels: labelsResult,
      states: [], // States are fetched per-team, so we'll populate this differently
      recentIssues: issuesResult,
      user: {
        id: viewer.id,
        email: viewer.email || '',
        name: viewer.name || viewer.displayName || '',
      },
    };

    // Fetch states for all teams in parallel
    const statesPromises = teamsResult.map(team => this.fetchTeamStates(team.id));
    const statesResults = await Promise.all(statesPromises);
    
    // Flatten and dedupe states by name
    const seenStates = new Set<string>();
    for (const states of statesResults) {
      for (const state of states) {
        if (!seenStates.has(state.name)) {
          seenStates.add(state.name);
          context.states.push(state);
        }
      }
    }

    // Update cache
    this.cache = context;
    this.cacheTimestamp = Date.now();

    return context;
  }

  /**
   * Get cached context without fetching
   * Returns null if no cache exists or cache is expired
   */
  getCachedContext(): WorkspaceContext | null {
    if (this.cache && Date.now() - this.cacheTimestamp < CACHE_TTL) {
      return this.cache;
    }
    return null;
  }

  /**
   * Invalidate the cache, forcing fresh fetch on next request
   */
  invalidateCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Fetch all teams in the workspace
   */
  private async fetchTeams(): Promise<WorkspaceContext['teams']> {
    try {
      const teams = await this.client.teams();
      return teams.nodes.map(team => ({
        id: team.id,
        key: team.key,
        name: team.name,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch all projects in the workspace
   */
  private async fetchProjects(): Promise<WorkspaceContext['projects']> {
    try {
      const projects = await this.client.projects({
        first: 50,
        orderBy: this.client.constructor.name ? undefined : undefined,
      });
      
      const result: WorkspaceContext['projects'] = [];
      
      for (const project of projects.nodes) {
        // Get team associations for this project
        const teams = await project.teams();
        const teamIds = teams.nodes.map(t => t.id);
        
        result.push({
          id: project.id,
          name: project.name,
          teamIds,
        });
      }
      
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Fetch common labels in the workspace
   */
  private async fetchLabels(): Promise<WorkspaceContext['labels']> {
    try {
      const labels = await this.client.issueLabels({
        first: MAX_LABELS,
      });
      
      return labels.nodes.map(label => ({
        id: label.id,
        name: label.name,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch workflow states for a specific team
   */
  private async fetchTeamStates(teamId: string): Promise<WorkspaceContext['states']> {
    try {
      const states = await this.client.workflowStates({
        filter: { team: { id: { eq: teamId } } },
      });
      
      return states.nodes.map(state => ({
        id: state.id,
        name: state.name,
        type: state.type,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch recent issues for pattern detection
   */
  private async fetchRecentIssues(): Promise<WorkspaceContext['recentIssues']> {
    try {
      const issues = await this.client.issues({
        first: MAX_RECENT_ISSUES,
        orderBy: this.client.constructor.name ? undefined : undefined,
      });
      
      const result: WorkspaceContext['recentIssues'] = [];
      
      for (const issue of issues.nodes) {
        const team = await issue.team;
        if (team) {
          result.push({
            id: issue.id,
            title: issue.title,
            teamKey: team.key,
            priority: issue.priority,
          });
        }
      }
      
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Find a team by key (case-insensitive)
   */
  findTeamByKey(key: string): WorkspaceContext['teams'][0] | undefined {
    const context = this.getCachedContext();
    if (!context) return undefined;
    
    const upperKey = key.toUpperCase();
    return context.teams.find(t => t.key.toUpperCase() === upperKey);
  }

  /**
   * Find a team by name (case-insensitive partial match)
   */
  findTeamByName(name: string): WorkspaceContext['teams'][0] | undefined {
    const context = this.getCachedContext();
    if (!context) return undefined;
    
    const lowerName = name.toLowerCase();
    return context.teams.find(t => 
      t.name.toLowerCase().includes(lowerName) ||
      t.key.toLowerCase() === lowerName
    );
  }

  /**
   * Find labels by names (case-insensitive)
   */
  findLabelsByNames(names: string[]): WorkspaceContext['labels'] {
    const context = this.getCachedContext();
    if (!context) return [];
    
    const lowerNames = names.map(n => n.toLowerCase());
    return context.labels.filter(l => 
      lowerNames.includes(l.name.toLowerCase())
    );
  }

  /**
   * Find a project by name (case-insensitive partial match)
   */
  findProjectByName(name: string): WorkspaceContext['projects'][0] | undefined {
    const context = this.getCachedContext();
    if (!context) return undefined;
    
    const lowerName = name.toLowerCase();
    return context.projects.find(p => 
      p.name.toLowerCase().includes(lowerName)
    );
  }

  /**
   * Get the default team based on recent issue patterns
   * Returns the most frequently used team in recent issues
   */
  getDefaultTeam(): WorkspaceContext['teams'][0] | undefined {
    const context = this.getCachedContext();
    if (!context || context.recentIssues.length === 0) {
      // Fall back to first team if no recent issues
      return context?.teams[0];
    }
    
    // Count team occurrences in recent issues
    const teamCounts = new Map<string, number>();
    for (const issue of context.recentIssues) {
      const count = teamCounts.get(issue.teamKey) || 0;
      teamCounts.set(issue.teamKey, count + 1);
    }
    
    // Find most common team
    let maxCount = 0;
    let defaultTeamKey: string | undefined;
    for (const [key, count] of teamCounts) {
      if (count > maxCount) {
        maxCount = count;
        defaultTeamKey = key;
      }
    }
    
    if (defaultTeamKey) {
      return context.teams.find(t => t.key === defaultTeamKey);
    }
    
    return context.teams[0];
  }
}
