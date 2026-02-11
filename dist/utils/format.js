import chalk from 'chalk';
/**
 * Box drawing characters for panels
 */
const BOX = {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    teeRight: '├',
    teeLeft: '┤',
};
/**
 * Status indicators with Unicode symbols
 */
const STATUS_ICONS = {
    backlog: '○',
    unstarted: '○',
    started: '◐',
    completed: '●',
    canceled: '✕',
    triage: '◇',
};
/**
 * Priority indicators
 */
const PRIORITY_ICONS = {
    0: '   ',
    1: '!!!',
    2: '!! ',
    3: '!  ',
    4: '   ',
};
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
    3: { label: 'Medium', color: chalk.cyan },
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
export async function formatIssueDetails(issue, options) {
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
    // Comments
    if (options?.comments) {
        lines.push('');
        lines.push(chalk.gray('─'.repeat(60)));
        lines.push(chalk.bold(`Comments (${options.comments.length})`));
        lines.push('');
        if (options.comments.length === 0) {
            lines.push(chalk.gray('  No comments.'));
        }
        else {
            for (const c of options.comments) {
                const user = await c.user;
                const userName = user?.name || user?.email || 'Unknown';
                const resolved = c.resolvedAt ? chalk.green(' [Resolved]') : '';
                lines.push(chalk.cyan(userName) + chalk.gray(` - ${formatTimeAgo(c.createdAt)}`) + resolved);
                const body = c.body || '';
                for (const bodyLine of body.split('\n')) {
                    lines.push(chalk.white(`  ${bodyLine}`));
                }
                lines.push('');
            }
        }
    }
    // URL
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
/**
 * Format a state with icon
 */
export function formatStateWithIcon(state) {
    const icon = STATUS_ICONS[state.type] || '○';
    const colorFn = STATE_COLORS[state.type] || chalk.white;
    return colorFn(`${icon} ${state.name}`);
}
/**
 * Format priority with icon
 */
export function formatPriorityWithIcon(priority) {
    const config = PRIORITY_MAP[priority] || PRIORITY_MAP[0];
    const icon = PRIORITY_ICONS[priority] || '   ';
    return config.color(`${icon} ${config.label}`);
}
/**
 * Create a horizontal divider
 */
export function divider(width = 60, char = '─') {
    return chalk.gray(char.repeat(width));
}
/**
 * Create a titled section divider
 */
export function sectionDivider(title, width = 60) {
    const padding = Math.max(0, width - title.length - 4);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return chalk.gray('─'.repeat(leftPad) + '[ ') + chalk.bold(title) + chalk.gray(' ]' + '─'.repeat(rightPad));
}
/**
 * Format a label with its color (hex color support)
 */
export function formatLabel(name, hexColor) {
    if (hexColor) {
        try {
            return chalk.hex(hexColor).bold(` ${name} `);
        }
        catch {
            return chalk.magenta.bold(` ${name} `);
        }
    }
    return chalk.magenta.bold(` ${name} `);
}
/**
 * Format a colored label badge
 */
export function formatLabelBadge(name, hexColor) {
    if (hexColor) {
        try {
            const bg = chalk.bgHex(hexColor).black;
            return bg(` ${name} `);
        }
        catch {
            return chalk.bgMagenta.white(` ${name} `);
        }
    }
    return chalk.bgMagenta.white(` ${name} `);
}
/**
 * Format a key-value pair with consistent alignment
 */
export function formatKeyValue(key, value, keyWidth = 12) {
    return chalk.gray(key.padEnd(keyWidth)) + value;
}
/**
 * Format an info box with a title
 */
export function formatInfoBox(title, lines, width = 60) {
    const result = [];
    const innerWidth = width - 4;
    // Top border with title
    const titlePadded = ` ${title} `;
    const topBorderLength = Math.max(0, width - titlePadded.length - 2);
    const leftBorder = Math.floor(topBorderLength / 2);
    const rightBorder = topBorderLength - leftBorder;
    result.push(chalk.gray(BOX.topLeft + BOX.horizontal.repeat(leftBorder)) +
        chalk.bold.cyan(titlePadded) +
        chalk.gray(BOX.horizontal.repeat(rightBorder) + BOX.topRight));
    // Content lines
    for (const line of lines) {
        const paddedLine = line.padEnd(innerWidth).slice(0, innerWidth);
        result.push(chalk.gray(BOX.vertical + ' ') + paddedLine + chalk.gray(' ' + BOX.vertical));
    }
    // Bottom border
    result.push(chalk.gray(BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight));
    return result.join('\n');
}
/**
 * Format a success message
 */
export function formatSuccess(message) {
    return chalk.green('✓ ') + message;
}
/**
 * Format an error message
 */
export function formatError(message) {
    return chalk.red('✗ ') + message;
}
/**
 * Format a warning message
 */
export function formatWarning(message) {
    return chalk.yellow('⚠ ') + message;
}
/**
 * Format an info message
 */
export function formatInfo(message) {
    return chalk.blue('ℹ ') + message;
}
/**
 * Format a list of items with bullets
 */
export function formatBulletList(items, indent = 2) {
    const indentStr = ' '.repeat(indent);
    return items.map(item => `${indentStr}${chalk.gray('•')} ${item}`).join('\n');
}
/**
 * Format a numbered list
 */
export function formatNumberedList(items, indent = 2) {
    const indentStr = ' '.repeat(indent);
    return items.map((item, i) => `${indentStr}${chalk.cyan(`${i + 1}.`)} ${item}`).join('\n');
}
/**
 * Format a table row with columns
 */
export function formatTableRow(columns, widths) {
    return columns
        .map((col, i) => truncate(col, widths[i]).padEnd(widths[i]))
        .join(' ');
}
/**
 * Format a table header with columns
 */
export function formatTableHeader(columns, widths) {
    const header = columns
        .map((col, i) => chalk.bold(col.padEnd(widths[i])))
        .join(' ');
    const separator = widths.map(w => '─'.repeat(w)).join('─');
    return header + '\n' + chalk.gray(separator);
}
/**
 * Create a simple spinner-style indicator text
 */
export function formatSpinner(text) {
    return chalk.cyan('◌ ') + chalk.gray(text + '...');
}
/**
 * Format time ago (e.g., "2 hours ago")
 */
export function formatTimeAgo(date) {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (seconds < 60)
        return 'just now';
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800)
        return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(then);
}
/**
 * Export box characters for external use
 */
export { BOX, STATUS_ICONS, PRIORITY_ICONS };
