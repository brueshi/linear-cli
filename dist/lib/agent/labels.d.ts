import type { LinearClient } from '@linear/sdk';
/**
 * Result of label resolution
 */
export interface LabelResolutionResult {
    /** IDs of all resolved labels (existing + newly created) */
    labelIds: string[];
    /** Labels that already existed */
    existingLabels: string[];
    /** Labels that were created */
    createdLabels: string[];
}
/**
 * Resolve label names to IDs, creating any that don't exist.
 *
 * @param client - Linear API client
 * @param labelNames - Array of label names to resolve
 * @param existingLabels - Array of existing labels from workspace context
 * @param teamId - Team ID for creating new labels
 * @returns Object containing label IDs and information about what was created
 */
export declare function resolveOrCreateLabels(client: LinearClient, labelNames: string[], existingLabels: {
    id: string;
    name: string;
}[], teamId: string): Promise<LabelResolutionResult>;
/**
 * Parse comma-separated label string into array
 */
export declare function parseLabels(labelString: string): string[];
