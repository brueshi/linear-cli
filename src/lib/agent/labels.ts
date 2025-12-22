import type { LinearClient } from '@linear/sdk';
import chalk from 'chalk';

/**
 * Convert a label name to title case (capitalize first letter of each word)
 * Examples: "backend" -> "Backend", "api integration" -> "Api Integration"
 */
function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

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
export async function resolveOrCreateLabels(
  client: LinearClient,
  labelNames: string[],
  existingLabels: { id: string; name: string }[],
  teamId: string
): Promise<LabelResolutionResult> {
  const result: LabelResolutionResult = {
    labelIds: [],
    existingLabels: [],
    createdLabels: [],
  };
  
  for (const name of labelNames) {
    // Check if label already exists (case-insensitive)
    const existing = existingLabels.find(
      l => l.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existing) {
      result.labelIds.push(existing.id);
      result.existingLabels.push(existing.name);
    } else {
      // Create the label with title case formatting
      const titleCaseName = toTitleCase(name);
      try {
        const payload = await client.createIssueLabel({
          name: titleCaseName,
          teamId,
        });
        const label = await payload.issueLabel;
        if (label) {
          result.labelIds.push(label.id);
          result.createdLabels.push(label.name);
        }
      } catch (error) {
        // Label creation might fail if it already exists (race condition)
        // or if the name is invalid - try to fetch it
        try {
          const labels = await client.issueLabels({
            filter: { name: { eq: titleCaseName } },
            first: 1,
          });
          if (labels.nodes.length > 0) {
            result.labelIds.push(labels.nodes[0].id);
            result.existingLabels.push(labels.nodes[0].name);
          }
        } catch {
          // Silently skip labels that can't be created or found
          console.log(chalk.yellow(`Warning: Could not create or find label "${titleCaseName}"`));
        }
      }
    }
  }
  
  return result;
}

/**
 * Parse comma-separated label string into array
 */
export function parseLabels(labelString: string): string[] {
  return labelString
    .split(',')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}
