import type { LinearClient } from '@linear/sdk';
import chalk from 'chalk';

/**
 * Vibrant color palette for labels
 * These are carefully selected to be visually distinct and appealing
 */
const LABEL_COLOR_PALETTE = [
  '#FF6B6B', // Coral Red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky Blue
  '#96CEB4', // Sage Green
  '#FFEAA7', // Soft Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Golden
  '#BB8FCE', // Lavender
  '#85C1E9', // Light Blue
  '#F8B500', // Amber
  '#00CEC9', // Cyan
  '#E17055', // Burnt Orange
  '#74B9FF', // Periwinkle
  '#A29BFE', // Light Purple
  '#FD79A8', // Pink
  '#00B894', // Emerald
  '#FDCB6E', // Marigold
  '#6C5CE7', // Indigo
  '#81ECEC', // Aqua
];

/**
 * Semantic color mappings for common label keywords
 */
const SEMANTIC_COLORS: Record<string, string> = {
  // Bug/Error related - Red tones
  'bug': '#E74C3C',
  'error': '#E74C3C',
  'fix': '#E74C3C',
  'critical': '#C0392B',
  'urgent': '#C0392B',
  'hotfix': '#E74C3C',

  // Feature related - Green tones
  'feature': '#27AE60',
  'enhancement': '#2ECC71',
  'improvement': '#58D68D',
  'new': '#27AE60',

  // UI/Frontend - Blue/Purple tones
  'ui': '#3498DB',
  'frontend': '#5DADE2',
  'design': '#9B59B6',
  'ux': '#8E44AD',
  'css': '#9B59B6',
  'styling': '#9B59B6',

  // Backend/API - Teal/Cyan tones
  'backend': '#1ABC9C',
  'api': '#16A085',
  'server': '#17A589',
  'database': '#148F77',
  'db': '#148F77',

  // DevOps/Infra - Orange tones
  'devops': '#E67E22',
  'infra': '#D35400',
  'infrastructure': '#D35400',
  'deploy': '#E67E22',
  'ci': '#F39C12',
  'cd': '#F39C12',

  // Testing - Yellow tones
  'test': '#F1C40F',
  'testing': '#F1C40F',
  'qa': '#F4D03F',

  // Documentation - Gray/Blue tones
  'docs': '#7F8C8D',
  'documentation': '#7F8C8D',
  'readme': '#95A5A6',

  // Security - Red/Orange tones
  'security': '#E74C3C',
  'auth': '#E74C3C',
  'authentication': '#E74C3C',

  // Performance - Yellow/Green tones
  'performance': '#F39C12',
  'optimization': '#F39C12',
  'perf': '#F39C12',

  // Priority indicators
  'high': '#E74C3C',
  'medium': '#F39C12',
  'low': '#3498DB',
  'p0': '#C0392B',
  'p1': '#E74C3C',
  'p2': '#F39C12',
  'p3': '#3498DB',

  // AI/ML related
  'ai': '#9B59B6',
  'ml': '#9B59B6',
  'machine-learning': '#9B59B6',
};

/**
 * Track used colors to avoid repetition within a session
 */
let colorIndex = 0;

/**
 * Get a color for a label based on its name
 * Uses semantic mapping first, then falls back to palette rotation
 */
function getLabelColor(labelName: string): string {
  const lowerName = labelName.toLowerCase();

  // Check for semantic matches
  for (const [keyword, color] of Object.entries(SEMANTIC_COLORS)) {
    if (lowerName.includes(keyword)) {
      return color;
    }
  }

  // Fall back to rotating through the palette
  const color = LABEL_COLOR_PALETTE[colorIndex % LABEL_COLOR_PALETTE.length];
  colorIndex++;
  return color;
}

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
      // Create the label with title case formatting and intelligent color
      const titleCaseName = toTitleCase(name);
      const labelColor = getLabelColor(name);
      try {
        const payload = await client.createIssueLabel({
          name: titleCaseName,
          teamId,
          color: labelColor,
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
