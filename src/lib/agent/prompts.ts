import type { WorkspaceContext } from './types.js';

/**
 * System prompt for Claude to extract structured issue data
 */
export const SYSTEM_PROMPT = `You are an AI assistant that extracts structured Linear issue data from natural language input.

Your task is to parse the user's input and extract the following fields:
- title: Concise issue title (required) - should be action-oriented and clear
- description: Well-formatted description with bullet points for clarity. Use markdown formatting:
  * Start with a brief summary sentence if needed
  * Use bullet points (- or *) for listing key details, steps, or requirements
  * Keep each bullet point concise and actionable
  * Separate sections with blank lines for readability
- teamKey: Team identifier if mentioned (e.g., ATT, FE, BE, OPS, backend, frontend)
- priority: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
- estimate: Story points (1, 2, 3, 5, 8, 13, 21) if mentioned
- labels: Array of relevant labels - prefer existing workspace labels when available
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
6. Format descriptions for readability:
   - Always use bullet points when there are multiple pieces of information
   - Structure: Brief context → Key details (bulleted) → Expected outcome (if applicable)
   - Example format:
     "Authentication failing for Safari users.

     - Browser: Safari 17+
     - Error: Session token not persisted
     - Impact: Users cannot stay logged in

     Expected: Users should remain authenticated across page refreshes."
7. For labels:
   - STRONGLY prefer using labels from the workspace's existing labels list
   - Match existing labels case-insensitively (e.g., if "API" exists, use "API" not "api")
   - Only suggest new labels if the concept is clearly distinct from existing ones
   - Extract from technical terms like: auth, api, database, frontend, backend, performance, security
8. Map team mentions to common patterns:
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
  
  // Add available projects
  if (context.projects.length > 0) {
    lines.push('Available projects in this workspace:');
    for (const project of context.projects.slice(0, 10)) {
      lines.push(`- ${project.name}`);
    }
    lines.push('');
  }
  
  // Add existing labels - emphasize these should be preferred
  if (context.labels.length > 0) {
    lines.push('EXISTING LABELS (prefer these over creating new ones):');
    const labelNames = context.labels.slice(0, 30).map(l => l.name);
    lines.push(labelNames.join(', '));
    lines.push('');
    lines.push('Note: Use these exact label names when they match the issue context. New labels can be created if needed, but existing ones are preferred.');
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
