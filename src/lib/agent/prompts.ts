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
- projectName: Project to assign the issue to (match against available workspace projects)
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
9. For project assignment (IMPORTANT - always try to assign a project when projects are available):
   - You MUST assign a projectName when workspace projects are available, unless the issue truly doesn't fit any project
   - Use project descriptions and recent issue patterns to determine the best fit
   - Study which projects recent issues were assigned to - this reveals how the workspace organizes work
   - Match by topic/domain, not just keyword:
     * A bug in the API layer should go to whichever project handles API/backend work
     * A new UI feature should go to whichever project handles frontend/UI work
   - If the issue type is a bug and there's a bug-related project, prefer that project
   - If the issue type is a feature and there's a features project, prefer that project
   - If multiple projects could match, choose the most specific one
   - When in doubt, look at which project similar recent issues were assigned to

Return ONLY valid JSON matching this exact schema, with no additional text or markdown:
{
  "title": "string (required)",
  "description": "string or null",
  "teamKey": "string or null",
  "projectName": "string or null",
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
  
  // Add available projects with descriptions and team info
  if (context.projects.length > 0) {
    // Filter to active projects (started, planned, or backlog)
    const activeProjects = context.projects.filter(p =>
      ['started', 'planned', 'backlog'].includes(p.state)
    );
    const projectsToShow = activeProjects.length > 0 ? activeProjects : context.projects;

    lines.push('Available projects in this workspace (you SHOULD assign one):');
    for (const project of projectsToShow.slice(0, 15)) {
      const teamNames = context.teams
        .filter(t => project.teamIds.includes(t.id))
        .map(t => t.key)
        .join(', ');
      const teamSuffix = teamNames ? ` [Team: ${teamNames}]` : '';
      const desc = project.description ? ` - ${project.description.slice(0, 100)}` : '';
      lines.push(`- "${project.name}"${teamSuffix}${desc}`);
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
  
  // Add recent issue patterns for context (including project assignments)
  if (context.recentIssues.length > 0) {
    lines.push('Recent issues (use these to understand project assignment patterns):');
    for (const issue of context.recentIssues.slice(0, 8)) {
      const priorityLabel = ['None', 'Urgent', 'High', 'Medium', 'Low'][issue.priority] || 'None';
      const projectSuffix = issue.projectName ? `, Project: "${issue.projectName}"` : '';
      lines.push(`- "${issue.title}" (Team: ${issue.teamKey}, Priority: ${priorityLabel}${projectSuffix})`);
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

/**
 * System prompt for Claude to extract structured update data from natural language
 */
export const UPDATE_SYSTEM_PROMPT = `You are an AI assistant that extracts structured issue update data from natural language input.

The user is providing an update about an existing Linear issue. Your task is to parse their input and determine what changes should be made to the issue.

Extract the following fields:
- comment: Text to add as a comment (if the input describes progress, findings, or information to record)
- statusChange: New status if mentioned (e.g., "done", "in progress", "in review", "blocked", "cancelled")
- priorityChange: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low (only if priority change is mentioned)
- addLabels: Array of labels to add (if mentioned)
- removeLabels: Array of labels to remove (if mentioned)
- titleUpdate: New title (only if explicitly requesting a title change)
- appendDescription: Text to append to description (if mentioned)
- assigneeChange: "me", "none", or a user name (if assignment change is mentioned)
- summary: Brief summary of what was done (for comment context)

Guidelines:
1. Detect status transitions from natural language:
   - "done", "finished", "completed", "fixed", "resolved" -> status: "done" or "completed"
   - "starting", "working on", "in progress", "begun" -> status: "in progress"
   - "ready for review", "needs review", "PR submitted" -> status: "in review"
   - "blocked", "stuck", "waiting" -> status: "blocked" (if available)
   - "cancelled", "won't fix", "not doing" -> status: "cancelled"
2. If the input describes work done or findings, create a meaningful comment
3. Keep comments informative but concise
4. Only include fields that are explicitly or strongly implied in the input
5. For labels, prefer existing workspace labels when context is provided

Return ONLY valid JSON matching this schema, with no additional text:
{
  "comment": "string or null",
  "statusChange": "string or null",
  "priorityChange": "number 0-4 or null",
  "addLabels": "array of strings or null",
  "removeLabels": "array of strings or null",
  "titleUpdate": "string or null",
  "appendDescription": "string or null",
  "assigneeChange": "string or null",
  "summary": "string or null"
}`;

/**
 * Build the update prompt with issue and workspace context
 */
export function buildUpdatePrompt(
  input: string, 
  issueContext: { identifier: string; title: string; currentStatus: string },
  workspaceContext?: WorkspaceContext
): string {
  const lines: string[] = [];
  
  // Add issue context
  lines.push('Issue being updated:');
  lines.push(`- Identifier: ${issueContext.identifier}`);
  lines.push(`- Title: ${issueContext.title}`);
  lines.push(`- Current Status: ${issueContext.currentStatus}`);
  lines.push('');
  
  // Add workspace context if available
  if (workspaceContext) {
    // Add available states
    if (workspaceContext.states.length > 0) {
      lines.push('Available workflow states:');
      for (const state of workspaceContext.states) {
        lines.push(`- ${state.name} (${state.type})`);
      }
      lines.push('');
    }
    
    // Add existing labels
    if (workspaceContext.labels.length > 0) {
      lines.push('Existing labels (prefer these):');
      const labelNames = workspaceContext.labels.slice(0, 20).map(l => l.name);
      lines.push(labelNames.join(', '));
      lines.push('');
    }
  }
  
  // Add user input
  lines.push('User update message:');
  lines.push(`"${input}"`);
  
  return lines.join('\n');
}
