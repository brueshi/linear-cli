import chalk from 'chalk';
/**
 * Color mapping for workflow state categories
 */
const STATE_COLORS = {
    backlog: chalk.gray,
    unstarted: chalk.blue,
    started: chalk.yellow,
    completed: chalk.green,
    canceled: chalk.red,
    triage: chalk.magenta,
};
/**
 * Priority labels and colors
 */
const PRIORITY_MAP = {
    0: { label: 'None', color: chalk.gray },
    1: { label: 'Urgent', color: chalk.red },
    2: { label: 'High', color: chalk.yellow },
    3: { label: 'Medium', color: chalk.blue },
    4: { label: 'Low', color: chalk.gray },
};
/**
 * Format a workflow state with appropriate color
 */
export function formatState(state) {
    const colorFn = STATE_COLORS[state.type] || chalk.white;
    return colorFn(state.name);
}
/**
 * Format priority with color
 */
export function formatPriority(priority) {
    const config = PRIORITY_MAP[priority] || PRIORITY_MAP[0];
    return config.color(config.label);
}
/**
 * Format an assignee name
 */
export function formatAssignee(assignee) {
    if (!assignee) {
        return chalk.gray('Unassigned');
    }
    return assignee.name || assignee.email;
}
/**
 * Format a date for display
 */
export function formatDate(date) {
    if (!date) {
        return chalk.gray('-');
    }
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
/**
 * Format an issue identifier (e.g., "ENG-123")
 */
export function formatIdentifier(identifier) {
    return chalk.cyan(identifier);
}
/**
 * Truncate text to a maximum length
 */
export function truncate(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength - 3) + '...';
}
/**
 * Format an issue for list display (single line)
 */
export async function formatIssueRow(issue) {
    const state = await issue.state;
    const assignee = await issue.assignee;
    const id = formatIdentifier(issue.identifier.padEnd(10));
    const title = truncate(issue.title, 50).padEnd(52);
    const stateStr = state ? formatState(state).padEnd(20) : chalk.gray('Unknown').padEnd(20);
    const assigneeStr = formatAssignee(assignee);
    return `${id} ${title} ${stateStr} ${assigneeStr}`;
}
/**
 * Format a detailed issue view
 */
export async function formatIssueDetails(issue) {
    const state = await issue.state;
    const assignee = await issue.assignee;
    const team = await issue.team;
    const project = await issue.project;
    const labels = await issue.labels();
    const lines = [];
    // Header
    lines.push(chalk.bold(formatIdentifier(issue.identifier) + ' ' + issue.title));
    lines.push('');
    // Metadata table
    lines.push(chalk.gray('Status:    ') + (state ? formatState(state) : chalk.gray('Unknown')));
    lines.push(chalk.gray('Priority:  ') + formatPriority(issue.priority));
    lines.push(chalk.gray('Assignee:  ') + formatAssignee(assignee));
    lines.push(chalk.gray('Team:      ') + (team ? team.name : chalk.gray('-')));
    if (project) {
        lines.push(chalk.gray('Project:   ') + project.name);
    }
    if (labels.nodes.length > 0) {
        const labelNames = labels.nodes.map(l => chalk.magenta(l.name)).join(', ');
        lines.push(chalk.gray('Labels:    ') + labelNames);
    }
    lines.push(chalk.gray('Created:   ') + formatDate(issue.createdAt));
    if (issue.dueDate) {
        lines.push(chalk.gray('Due:       ') + formatDate(new Date(issue.dueDate)));
    }
    // Description
    if (issue.description) {
        lines.push('');
        lines.push(chalk.gray('Description:'));
        lines.push(issue.description);
    }
    // URL
    lines.push('');
    lines.push(chalk.gray('URL: ') + chalk.underline(issue.url));
    return lines.join('\n');
}
/**
 * Print a list header
 */
export function printListHeader() {
    const header = chalk.bold('ID'.padEnd(10) + ' ' +
        'Title'.padEnd(52) + ' ' +
        'Status'.padEnd(20) + ' ' +
        'Assignee');
    console.log(header);
    console.log(chalk.gray('-'.repeat(100)));
}
/**
 * Format a comment for display
 */
export function formatComment(author, createdAt, body, resolved) {
    const lines = [];
    const dateStr = formatDate(createdAt);
    const resolvedStr = resolved ? chalk.green(' [Resolved]') : '';
    lines.push(chalk.cyan(author) + chalk.gray(` - ${dateStr}`) + resolvedStr);
    const bodyLines = body.split('\n');
    for (const line of bodyLines) {
        lines.push(chalk.white(`  ${line}`));
    }
    return lines.join('\n');
}
/**
 * Format a search result highlight
 */
export function formatSearchHighlight(text, query) {
    if (!query)
        return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, chalk.yellow.bold('$1'));
}
/**
 * Escape special regex characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Format a progress bar
 */
export function formatProgressBar(current, total, width = 20) {
    const percentage = total > 0 ? current / total : 0;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const pct = Math.round(percentage * 100);
    return `${bar} ${pct}%`;
}
/**
 * Format a batch summary
 */
export function formatBatchSummary(succeeded, failed, total) {
    const lines = [];
    lines.push(chalk.bold('Summary:'));
    lines.push(`  ${chalk.green(`${succeeded} succeeded`)}`);
    if (failed > 0) {
        lines.push(`  ${chalk.red(`${failed} failed`)}`);
    }
    lines.push(`  ${chalk.gray(`${total} total`)}`);
    return lines.join('\n');
}
