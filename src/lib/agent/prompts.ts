import type { WorkspaceContext } from './types.js';

/**
 * System prompt for Claude to extract structured issue data
 */
export const SYSTEM_PROMPT = `You are an AI assistant that extracts structured Linear issue data from natural language input.

Your task is to parse the user's input and extract the following fields:
- title: Concise issue title (required) - should be action-oriented and clear
- description: Detailed description if the input contains additional context
- teamKey: Team identifier if mentioned (e.g., ATT, FE, BE, OPS, backend, frontend)
- priority: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
- estimate: Story points (1, 2, 3, 5, 8, 13, 21) if mentioned
- labels: Array of relevant labels extracted from technical terms
- issueType: bug, feature, improvement, or task
- dueDate: ISO date string if a deadline is mentioned

Guidelines:
1. Extract only information explicitly stated or clearly implied in the input
2. Use null for fields not mentioned or not inferable from the input
3. Infer issue type from context:
   - bug: fix, broke, broken, error, crash, failing, doesn't work, issue with
   - feature: add, new, implement, create, build, support
   - improvement: refactor, improve, enhance, optimize, update, upgrade
   - task: update, change, configure, set up, migrate
4. Detect urgency keywords for priority:
   - Urgent (1): urgent, ASAP, critical, emergency, production down, P0
   - High (2): high priority, important, soon, P1
   - Medium (3): medium, normal, P2
   - Low (4): low priority, when possible, nice to have, P3, P4
5. Keep titles concise (under 80 characters) and action-oriented
6. Extract technical terms as potential labels (e.g., auth, api, database, frontend, backend, performance, security)
7. Map team mentions to common patterns:
   - backend, BE, server, api -> likely backend team
   - frontend, FE, UI, client -> likely frontend team
   - devops, ops, infra, infrastructure -> likely ops team

Return ONLY valid JSON matching this exact schema, with no additional text or markdown:
{
  "title": "string (required)",
  "description": "string or null",
  "teamKey": "string or null",
  "priority": "number 0-4 or null",
  "estimate": "number or null",
  "labels": "array of strings or null",
  "issueType": "bug|feature|improvement|task or null",
  "dueDate": "ISO date string or null"
}`;

/**
 * Build context section for the prompt with workspace information
 */
export function buildContextPrompt(context: WorkspaceContext): string {
  const lines: string[] = [];
  
  // Add available teams
  if (context.teams.length > 0) {
    lines.push('Available teams in this workspace:');
    for (const team of context.teams) {
      lines.push(`- ${team.key}: ${team.name}`);
    }
    lines.push('');
  }
  
  // Add common labels
  if (context.labels.length > 0) {
    lines.push('Common labels (use these when applicable):');
    const labelNames = context.labels.slice(0, 20).map(l => l.name);
    lines.push(labelNames.join(', '));
    lines.push('');
  }
  
  // Add recent issue patterns for context
  if (context.recentIssues.length > 0) {
    lines.push('Recent issue patterns in this workspace:');
    for (const issue of context.recentIssues.slice(0, 5)) {
      const priorityLabel = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || 'None';
      lines.push(`- "${issue.title}" (Team: ${issue.teamKey}, Priority: ${priorityLabel})`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Build the complete user prompt with optional context
 */
export function buildUserPrompt(input: string, context?: WorkspaceContext): string {
  const lines: string[] = [];
  
  // Add workspace context if available
  if (context) {
    const contextSection = buildContextPrompt(context);
    if (contextSection.trim()) {
      lines.push('Workspace context:');
      lines.push(contextSection);
    }
  }
  
  // Add user input
  lines.push('User input to parse:');
  lines.push(`"${input}"`);
  
  return lines.join('\n');
}

/**
 * Sanitize user input to prevent prompt injection
 */
export function sanitizeInput(input: string): string {
  return input
    // Remove potential prompt injection patterns
    .replace(/\bsystem:\b/gi, '')
    .replace(/\bassistant:\b/gi, '')
    .replace(/\buser:\b/gi, '')
    .replace(/\bhuman:\b/gi, '')
    // Remove XML-like tags that could interfere
    .replace(/<\|.*?\|>/g, '')
    .replace(/<[^>]*>/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
