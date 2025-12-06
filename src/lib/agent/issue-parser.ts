import type { ExtractedIssueData, WorkspaceContext } from './types.js';
import type { Config } from '../config.js';

/**
 * Input format for Linear SDK createIssue
 */
export interface LinearIssueInput {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  estimate?: number;
  labelIds?: string[];
  projectId?: string;
  assigneeId?: string;
  dueDate?: string;
}

/**
 * Result of parsing extracted data
 */
export interface ParseResult {
  /** Linear-ready issue input */
  input: LinearIssueInput;
  
  /** Resolved team information */
  team: {
    id: string;
    key: string;
    name: string;
  } | null;
  
  /** Resolved labels */
  labels: Array<{ id: string; name: string }>;
  
  /** Warnings about unresolved data */
  warnings: string[];
}

/**
 * Issue Parser - Converts AI-extracted data to Linear SDK format
 * 
 * Handles resolution of team keys to IDs, label names to IDs,
 * and applies intelligent defaults from config and workspace patterns.
 */
export class IssueParser {
  /**
   * Parse extracted issue data into Linear SDK format
   */
  parse(
    extracted: ExtractedIssueData,
    context: WorkspaceContext,
    config: Config
  ): ParseResult {
    const warnings: string[] = [];
    
    // Resolve team
    const team = this.resolveTeam(extracted, context, config);
    if (!team && extracted.teamKey) {
      warnings.push(`Team "${extracted.teamKey}" not found in workspace`);
    }
    
    // Resolve labels
    const labels = this.resolveLabels(extracted.labels || [], context);
    const unresolvedLabels = (extracted.labels || []).filter(
      name => !labels.find(l => l.name.toLowerCase() === name.toLowerCase())
    );
    if (unresolvedLabels.length > 0) {
      warnings.push(`Labels not found: ${unresolvedLabels.join(', ')}`);
    }
    
    // Resolve project
    let projectId: string | undefined;
    if (extracted.projectId) {
      const project = context.projects.find(p => p.id === extracted.projectId);
      if (project) {
        projectId = project.id;
      } else {
        warnings.push(`Project ID "${extracted.projectId}" not found`);
      }
    }
    
    // Build Linear issue input
    const input: LinearIssueInput = {
      teamId: team?.id || '',
      title: extracted.title,
    };
    
    // Add optional fields if present
    if (extracted.description) {
      input.description = extracted.description;
    }
    
    if (extracted.priority !== undefined && extracted.priority >= 0 && extracted.priority <= 4) {
      input.priority = extracted.priority;
    } else if (config.defaultPriority !== undefined) {
      input.priority = config.defaultPriority;
    }
    
    if (extracted.estimate !== undefined && extracted.estimate > 0) {
      input.estimate = extracted.estimate;
    }
    
    if (labels.length > 0) {
      input.labelIds = labels.map(l => l.id);
    }
    
    if (projectId) {
      input.projectId = projectId;
    }
    
    if (extracted.assigneeId) {
      input.assigneeId = extracted.assigneeId;
    }
    
    if (extracted.dueDate) {
      input.dueDate = extracted.dueDate;
    }
    
    return {
      input,
      team,
      labels,
      warnings,
    };
  }

  /**
   * Resolve team from extracted data, config defaults, or workspace patterns
   */
  private resolveTeam(
    extracted: ExtractedIssueData,
    context: WorkspaceContext,
    config: Config
  ): WorkspaceContext['teams'][0] | null {
    // 1. Try extracted team key
    if (extracted.teamKey) {
      const team = this.findTeamByKey(extracted.teamKey, context);
      if (team) return team;
      
      // Try matching by name patterns
      const teamByName = this.findTeamByNamePattern(extracted.teamKey, context);
      if (teamByName) return teamByName;
    }
    
    // 2. Try team ID if directly provided
    if (extracted.teamId) {
      const team = context.teams.find(t => t.id === extracted.teamId);
      if (team) return team;
    }
    
    // 3. Try config default team
    if (config.defaultTeam) {
      const team = this.findTeamByKey(config.defaultTeam, context);
      if (team) return team;
    }
    
    // 4. Infer from recent issues pattern
    const inferredTeam = this.inferTeamFromPatterns(context);
    if (inferredTeam) return inferredTeam;
    
    // 5. Fall back to first team if only one exists
    if (context.teams.length === 1) {
      return context.teams[0];
    }
    
    return null;
  }

  /**
   * Find team by key (case-insensitive)
   */
  private findTeamByKey(
    key: string,
    context: WorkspaceContext
  ): WorkspaceContext['teams'][0] | null {
    const upperKey = key.toUpperCase();
    return context.teams.find(t => t.key.toUpperCase() === upperKey) || null;
  }

  /**
   * Find team by name pattern (handles common aliases)
   */
  private findTeamByNamePattern(
    pattern: string,
    context: WorkspaceContext
  ): WorkspaceContext['teams'][0] | null {
    const lowerPattern = pattern.toLowerCase();
    
    // Common team name patterns
    const patterns: Record<string, string[]> = {
      'backend': ['backend', 'be', 'server', 'api'],
      'frontend': ['frontend', 'fe', 'client', 'ui', 'web'],
      'devops': ['devops', 'ops', 'infra', 'infrastructure', 'platform'],
      'mobile': ['mobile', 'ios', 'android', 'app'],
      'design': ['design', 'ux', 'ui'],
      'qa': ['qa', 'quality', 'test', 'testing'],
    };
    
    // Check if pattern matches any known alias
    for (const [category, aliases] of Object.entries(patterns)) {
      if (aliases.includes(lowerPattern)) {
        // Find a team that matches this category
        const team = context.teams.find(t => {
          const teamLower = t.name.toLowerCase();
          return aliases.some(alias => teamLower.includes(alias));
        });
        if (team) return team;
      }
    }
    
    // Direct name match
    return context.teams.find(t => 
      t.name.toLowerCase().includes(lowerPattern)
    ) || null;
  }

  /**
   * Infer team from recent issue patterns
   */
  private inferTeamFromPatterns(
    context: WorkspaceContext
  ): WorkspaceContext['teams'][0] | null {
    if (context.recentIssues.length === 0) {
      return null;
    }
    
    // Count team occurrences
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
      return context.teams.find(t => t.key === defaultTeamKey) || null;
    }
    
    return null;
  }

  /**
   * Resolve label names to label objects
   */
  private resolveLabels(
    labelNames: string[],
    context: WorkspaceContext
  ): Array<{ id: string; name: string }> {
    const resolved: Array<{ id: string; name: string }> = [];
    
    for (const name of labelNames) {
      const label = context.labels.find(l => 
        l.name.toLowerCase() === name.toLowerCase()
      );
      if (label) {
        resolved.push(label);
      }
    }
    
    return resolved;
  }

  /**
   * Apply intelligent defaults to extracted data
   */
  applyDefaults(
    extracted: ExtractedIssueData,
    context: WorkspaceContext,
    config: Config
  ): ExtractedIssueData {
    const result = { ...extracted };
    
    // Apply default priority if not set
    if (result.priority === undefined && config.defaultPriority !== undefined) {
      result.priority = config.defaultPriority;
    }
    
    // Apply default team if not set
    if (!result.teamKey && !result.teamId && config.defaultTeam) {
      result.teamKey = config.defaultTeam;
    }
    
    // Infer issue type from title if not set
    if (!result.issueType) {
      result.issueType = this.inferIssueType(result.title, result.description);
    }
    
    return result;
  }

  /**
   * Infer issue type from title and description keywords
   */
  private inferIssueType(
    title: string,
    description?: string
  ): ExtractedIssueData['issueType'] {
    const text = `${title} ${description || ''}`.toLowerCase();
    
    // Bug indicators
    const bugKeywords = ['fix', 'bug', 'error', 'crash', 'broken', 'failing', 'issue', 'problem', 'wrong', 'incorrect'];
    if (bugKeywords.some(kw => text.includes(kw))) {
      return 'bug';
    }
    
    // Feature indicators
    const featureKeywords = ['add', 'new', 'implement', 'create', 'build', 'support', 'enable'];
    if (featureKeywords.some(kw => text.includes(kw))) {
      return 'feature';
    }
    
    // Improvement indicators
    const improvementKeywords = ['improve', 'enhance', 'refactor', 'optimize', 'update', 'upgrade', 'better'];
    if (improvementKeywords.some(kw => text.includes(kw))) {
      return 'improvement';
    }
    
    // Default to task
    return 'task';
  }
}
