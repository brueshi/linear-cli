import type { ExtractedIssueData, WorkspaceContext, ValidationResult } from './types.js';

/**
 * Validator - Validates extracted issue data against workspace context
 * 
 * Ensures that:
 * - Required fields are present
 * - Team/project IDs exist in the workspace
 * - Priority values are in valid range
 * - Provides helpful error messages
 */
export class Validator {
  /**
   * Validate extracted issue data
   */
  validate(
    data: ExtractedIssueData,
    context: WorkspaceContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const enriched: Partial<ExtractedIssueData> = {};

    // Required: Title
    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    } else if (data.title.length > 200) {
      warnings.push('Title is very long (>200 chars), consider shortening');
    }

    // Validate team
    const teamValidation = this.validateTeam(data, context);
    if (teamValidation.error) {
      errors.push(teamValidation.error);
    }
    if (teamValidation.warning) {
      warnings.push(teamValidation.warning);
    }
    if (teamValidation.teamId) {
      enriched.teamId = teamValidation.teamId;
    }

    // Validate priority
    if (data.priority !== undefined) {
      if (!this.validatePriority(data.priority)) {
        errors.push(`Invalid priority: ${data.priority}. Must be 0-4`);
      }
    }

    // Validate estimate
    if (data.estimate !== undefined) {
      if (!this.validateEstimate(data.estimate)) {
        warnings.push(`Unusual estimate: ${data.estimate}. Common values: 1, 2, 3, 5, 8, 13, 21`);
      }
    }

    // Validate project if specified
    if (data.projectId) {
      const projectExists = context.projects.some(p => p.id === data.projectId);
      if (!projectExists) {
        warnings.push(`Project ID "${data.projectId}" not found in workspace`);
      }
    }

    // Validate labels if specified
    if (data.labels && data.labels.length > 0) {
      const foundLabels: string[] = [];
      const missingLabels: string[] = [];
      
      for (const labelName of data.labels) {
        const exists = context.labels.some(
          l => l.name.toLowerCase() === labelName.toLowerCase()
        );
        if (exists) {
          foundLabels.push(labelName);
        } else {
          missingLabels.push(labelName);
        }
      }
      
      if (missingLabels.length > 0) {
        warnings.push(`Labels not found in workspace: ${missingLabels.join(', ')}`);
      }
      
      // Update labels to only include found ones
      if (foundLabels.length > 0) {
        enriched.labels = foundLabels;
      }
    }

    // Validate due date format
    if (data.dueDate) {
      const date = new Date(data.dueDate);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid due date format: ${data.dueDate}`);
      } else if (date < new Date()) {
        warnings.push('Due date is in the past');
      }
    }

    // Validate assignee if specified
    if (data.assigneeId) {
      // We don't have a user list in context, so just note it
      // The Linear API will validate this
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      enriched,
    };
  }

  /**
   * Validate and resolve team
   */
  private validateTeam(
    data: ExtractedIssueData,
    context: WorkspaceContext
  ): { error?: string; warning?: string; teamId?: string } {
    // If teamId is directly provided, verify it exists
    if (data.teamId) {
      const team = context.teams.find(t => t.id === data.teamId);
      if (!team) {
        return { error: `Team ID "${data.teamId}" not found in workspace` };
      }
      return { teamId: team.id };
    }

    // If teamKey is provided, try to resolve it
    if (data.teamKey) {
      const team = context.teams.find(
        t => t.key.toUpperCase() === data.teamKey!.toUpperCase()
      );
      
      if (team) {
        return { teamId: team.id };
      }
      
      // Try partial name match
      const teamByName = context.teams.find(
        t => t.name.toLowerCase().includes(data.teamKey!.toLowerCase())
      );
      
      if (teamByName) {
        return {
          teamId: teamByName.id,
          warning: `Matched "${data.teamKey}" to team "${teamByName.name}" (${teamByName.key})`,
        };
      }
      
      // Team key not found - list available teams
      const availableTeams = context.teams.map(t => `${t.key} (${t.name})`).join(', ');
      return {
        error: `Team "${data.teamKey}" not found. Available: ${availableTeams}`,
      };
    }

    // No team specified - this might be okay if there's only one team
    if (context.teams.length === 1) {
      return {
        teamId: context.teams[0].id,
        warning: `Using default team: ${context.teams[0].name}`,
      };
    }

    // Multiple teams, none specified
    if (context.teams.length > 1) {
      return {
        warning: 'No team specified. You may need to select one.',
      };
    }

    // No teams at all
    return {
      error: 'No teams found in workspace',
    };
  }

  /**
   * Validate priority value (0-4)
   */
  private validatePriority(priority: number): boolean {
    return Number.isInteger(priority) && priority >= 0 && priority <= 4;
  }

  /**
   * Validate estimate value (common fibonacci-like values)
   */
  private validateEstimate(estimate: number): boolean {
    const validEstimates = [0.5, 1, 2, 3, 5, 8, 13, 21];
    // Allow any positive number, but prefer fibonacci
    return estimate > 0 && (validEstimates.includes(estimate) || estimate <= 21);
  }

  /**
   * Get suggestions for fixing validation errors
   */
  getSuggestions(result: ValidationResult, context: WorkspaceContext): string[] {
    const suggestions: string[] = [];

    for (const error of result.errors) {
      if (error.includes('Team') && error.includes('not found')) {
        suggestions.push(
          `Use --team flag to specify a team: ${context.teams.map(t => t.key).join(', ')}`
        );
      }
      
      if (error.includes('Title is required')) {
        suggestions.push('Provide a clear, action-oriented title for the issue');
      }
      
      if (error.includes('Invalid priority')) {
        suggestions.push('Priority values: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low');
      }
    }

    return suggestions;
  }
}
