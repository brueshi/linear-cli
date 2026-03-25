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
export declare class Validator {
    /**
     * Validate extracted issue data
     */
    validate(data: ExtractedIssueData, context: WorkspaceContext): ValidationResult;
    /**
     * Validate and resolve team
     */
    private validateTeam;
    /**
     * Validate priority value (0-4)
     */
    private validatePriority;
    /**
     * Validate estimate value (common fibonacci-like values)
     */
    private validateEstimate;
    /**
     * Get suggestions for fixing validation errors
     */
    getSuggestions(result: ValidationResult, context: WorkspaceContext): string[];
}
