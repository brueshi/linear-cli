/**
 * JSON output utilities for machine-readable CLI responses
 *
 * Enables coding agents (Cursor, Claude Code) to parse CLI output programmatically
 * without needing regex or text parsing.
 */
// ─────────────────────────────────────────────────────────────────
// Exit Codes
// ─────────────────────────────────────────────────────────────────
export const ExitCodes = {
    SUCCESS: 0,
    GENERAL_ERROR: 1,
    AUTH_FAILURE: 2,
    NOT_FOUND: 3,
    RATE_LIMITED: 4,
    VALIDATION_ERROR: 5,
};
// ─────────────────────────────────────────────────────────────────
// Global JSON Mode State
// ─────────────────────────────────────────────────────────────────
let jsonModeEnabled = false;
/**
 * Enable JSON output mode
 */
export function enableJsonMode() {
    jsonModeEnabled = true;
}
/**
 * Check if JSON mode is enabled
 */
export function isJsonMode() {
    return jsonModeEnabled;
}
// ─────────────────────────────────────────────────────────────────
// Output Functions
// ─────────────────────────────────────────────────────────────────
/**
 * Output success response in JSON format
 */
export function outputJson(data) {
    const response = {
        success: true,
        data,
    };
    console.log(JSON.stringify(response, null, 2));
}
/**
 * Output error response in JSON format
 */
export function outputJsonError(code, message) {
    const response = {
        success: false,
        error: { code, message },
    };
    console.log(JSON.stringify(response, null, 2));
}
/**
 * Output raw JSON (for simple data)
 */
export function outputRawJson(data) {
    console.log(JSON.stringify(data, null, 2));
}
// ─────────────────────────────────────────────────────────────────
// Conversion Functions
// ─────────────────────────────────────────────────────────────────
const PRIORITY_LABELS = {
    0: 'No priority',
    1: 'Urgent',
    2: 'High',
    3: 'Medium',
    4: 'Low',
};
/**
 * Convert Linear SDK Issue to JSON format
 */
export async function issueToJson(issue, options) {
    const [state, team, project, labels, assignee, creator] = await Promise.all([
        issue.state,
        issue.team,
        issue.project,
        issue.labels(),
        issue.assignee,
        issue.creator,
    ]);
    const result = {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || undefined,
        url: issue.url,
        priority: issue.priority,
        priorityLabel: PRIORITY_LABELS[issue.priority] || 'Unknown',
        estimate: issue.estimate || undefined,
        dueDate: issue.dueDate || undefined,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        status: state ? {
            id: state.id,
            name: state.name,
            type: state.type,
        } : {
            id: '',
            name: 'Unknown',
            type: 'unknown',
        },
        team: team ? {
            id: team.id,
            key: team.key,
            name: team.name,
        } : {
            id: '',
            key: '',
            name: 'Unknown',
        },
        project: project ? {
            id: project.id,
            name: project.name,
        } : undefined,
        labels: labels.nodes.map(l => ({
            id: l.id,
            name: l.name,
            color: l.color,
        })),
        assignee: assignee ? {
            id: assignee.id,
            name: assignee.name || assignee.displayName || '',
            email: assignee.email || '',
        } : undefined,
        creator: creator ? {
            id: creator.id,
            name: creator.name || creator.displayName || '',
            email: creator.email || '',
        } : undefined,
    };
    if (options?.includeComments) {
        const commentNodes = options.comments ?? (await issue.comments({ first: 50 })).nodes;
        result.comments = await Promise.all(commentNodes.map(c => commentToJson(c)));
    }
    return result;
}
/**
 * Convert Linear SDK IssueSearchResult to JSON format.
 * IssueSearchResult has the same shape as Issue but is a different class.
 */
export async function issueSearchResultToJson(issue) {
    const [state, team, project, assignee, creator] = await Promise.all([
        issue.state,
        issue.team,
        issue.project,
        issue.assignee,
        issue.creator,
    ]);
    return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || undefined,
        url: issue.url,
        priority: issue.priority,
        priorityLabel: issue.priorityLabel || PRIORITY_LABELS[issue.priority] || 'Unknown',
        estimate: issue.estimate || undefined,
        dueDate: issue.dueDate || undefined,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        status: state ? {
            id: state.id,
            name: state.name,
            type: state.type,
        } : { id: '', name: 'Unknown', type: 'unknown' },
        team: team ? {
            id: team.id,
            key: team.key,
            name: team.name,
        } : { id: '', key: '', name: 'Unknown' },
        project: project ? {
            id: project.id,
            name: project.name,
        } : undefined,
        labels: issue.labelIds.map((id) => ({
            id,
            name: '',
        })),
        assignee: assignee ? {
            id: assignee.id,
            name: assignee.name || assignee.displayName || '',
            email: assignee.email || '',
        } : undefined,
        creator: creator ? {
            id: creator.id,
            name: creator.name || creator.displayName || '',
            email: creator.email || '',
        } : undefined,
    };
}
/**
 * Convert Linear SDK DocumentSearchResult to DocumentJson format.
 */
export async function documentSearchResultToJson(doc) {
    const project = await doc.project;
    const creator = await doc.creator;
    return {
        id: doc.id,
        title: doc.title,
        content: doc.content || undefined,
        icon: doc.icon || undefined,
        color: doc.color || undefined,
        slugId: doc.slugId,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        url: doc.url,
        project: project ? {
            id: project.id,
            name: project.name,
        } : undefined,
        creator: creator ? {
            id: creator.id,
            name: creator.name || creator.displayName || '',
            email: creator.email || '',
        } : undefined,
    };
}
/**
 * Convert Linear SDK Comment to JSON format
 */
export async function commentToJson(comment) {
    const user = await comment.user;
    return {
        id: comment.id,
        body: comment.body || '',
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        resolved: !!comment.resolvedAt,
        resolvedAt: comment.resolvedAt?.toISOString(),
        user: user ? {
            id: user.id,
            name: user.name || user.displayName || '',
            email: user.email || '',
        } : {
            id: '',
            name: 'Unknown',
            email: '',
        },
    };
}
/**
 * Convert Linear SDK Project to JSON format
 */
export async function projectToJson(project) {
    const [teams, issues] = await Promise.all([
        project.teams(),
        project.issues({ first: 100 }),
    ]);
    const completedCount = issues.nodes.filter(i => i.completedAt).length;
    return {
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        state: project.state,
        progress: project.progress,
        startDate: project.startDate || undefined,
        targetDate: project.targetDate || undefined,
        url: project.url,
        teams: teams.nodes.map(t => ({
            id: t.id,
            key: t.key,
            name: t.name,
        })),
        issueCount: issues.nodes.length,
        completedIssueCount: completedCount,
    };
}
/**
 * Convert Linear SDK IssueLabel to JSON format
 */
export function labelToJson(label) {
    return {
        id: label.id,
        name: label.name,
        description: label.description || undefined,
        color: label.color,
        isGroup: label.isGroup || false,
        parent: undefined, // Would need async fetch if needed
    };
}
/**
 * Convert Linear SDK Attachment to JSON format
 */
export function attachmentToJson(attachment) {
    return {
        id: attachment.id,
        title: attachment.title,
        url: attachment.url,
        subtitle: attachment.subtitle || undefined,
        sourceType: attachment.sourceType || undefined,
        createdAt: attachment.createdAt.toISOString(),
    };
}
/**
 * Convert Linear SDK WorkflowState to JSON format
 */
export function stateToJson(state) {
    return {
        id: state.id,
        name: state.name,
        type: state.type,
        color: state.color,
        position: state.position,
    };
}
/**
 * Convert Linear SDK User to minimal JSON format
 */
export function userToJson(user) {
    return {
        id: user.id,
        name: user.name || user.displayName || '',
        email: user.email || '',
    };
}
/**
 * Convert Linear SDK Cycle to JSON format
 */
export async function cycleToJson(cycle) {
    const team = await cycle.team;
    return {
        id: cycle.id,
        number: cycle.number,
        name: cycle.name || undefined,
        description: cycle.description || undefined,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        completedAt: cycle.completedAt?.toISOString(),
        progress: cycle.progress,
        issueCountHistory: cycle.issueCountHistory,
        completedIssueCountHistory: cycle.completedIssueCountHistory,
        isActive: cycle.isActive,
        team: team ? {
            id: team.id,
            key: team.key,
            name: team.name,
        } : { id: '', key: '', name: 'Unknown' },
    };
}
/**
 * Convert Linear SDK Document to JSON format
 */
export async function documentToJson(doc) {
    const project = await doc.project;
    const creator = await doc.creator;
    return {
        id: doc.id,
        title: doc.title,
        content: doc.content || undefined,
        icon: doc.icon || undefined,
        color: doc.color || undefined,
        slugId: doc.slugId,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        url: doc.url,
        project: project ? {
            id: project.id,
            name: project.name,
        } : undefined,
        creator: creator ? {
            id: creator.id,
            name: creator.name || creator.displayName || '',
            email: creator.email || '',
        } : undefined,
    };
}
/**
 * Convert Linear SDK IssueRelation to JSON format
 */
export async function relationToJson(relation) {
    const issue = await relation.issue;
    const relatedIssue = await relation.relatedIssue;
    return {
        id: relation.id,
        type: relation.type,
        issue: issue ? {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
        } : { id: '', identifier: '', title: 'Unknown', url: '' },
        relatedIssue: relatedIssue ? {
            id: relatedIssue.id,
            identifier: relatedIssue.identifier,
            title: relatedIssue.title,
            url: relatedIssue.url,
        } : { id: '', identifier: '', title: 'Unknown', url: '' },
    };
}
/**
 * Convert Linear SDK ProjectUpdate to JSON format
 */
export async function projectUpdateToJson(update) {
    const user = await update.user;
    const project = await update.project;
    return {
        id: update.id,
        body: update.body,
        health: update.health,
        createdAt: update.createdAt.toISOString(),
        updatedAt: update.updatedAt.toISOString(),
        url: update.url,
        user: user ? {
            id: user.id,
            name: user.name || user.displayName || '',
            email: user.email || '',
        } : { id: '', name: 'Unknown', email: '' },
        project: project ? {
            id: project.id,
            name: project.name,
        } : { id: '', name: 'Unknown' },
    };
}
