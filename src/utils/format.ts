import chalk from 'chalk';
import type { Issue, WorkflowState, User, Comment } from '@linear/sdk';

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
const STATUS_ICONS: Record<string, string> = {
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
const PRIORITY_ICONS: Record<number, string> = {
  0: '   ',
  1: '!!!',
  2: '!! ',
  3: '!  ',
  4: '   ',
};

/**
 * Color mapping for workflow state categories
 */
const STATE_COLORS: Record<string, (text: string) => string> = {
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
const PRIORITY_MAP: Record<number, { label: string; color: (text: string) => string }> = {
  0: { label: 'None', color: chalk.gray },
  1: { label: 'Urgent', color: chalk.red },
  2: { label: 'High', color: chalk.yellow },
  3: { label: 'Medium', color: chalk.cyan },
  4: { label: 'Low', color: chalk.gray },
};

/**
 * Format a workflow state with appropriate color
 */
export function formatState(state: WorkflowState): string {
  const colorFn = STATE_COLORS[state.type] || chalk.white;
  return colorFn(state.name);
}

/**
 * Format priority with color
 */
export function formatPriority(priority: number): string {
  const config = PRIORITY_MAP[priority] || PRIORITY_MAP[0];
  return config.color(config.label);
}

/**
 * Format an assignee name
 */
export function formatAssignee(assignee: User | undefined | null): string {
  if (!assignee) {
    return chalk.gray('Unassigned');
  }
  return assignee.name || assignee.email;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | undefined | null): string {
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
export function formatIdentifier(identifier: string): string {
  return chalk.cyan(identifier);
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format an issue for list display (single line)
 */
export async function formatIssueRow(issue: Issue): Promise<string> {
  const state = await issue.state;
  const assignee = await issue.assignee;
  
  const id = formatIdentifier(issue.identifier.padEnd(10));
  const title = truncate(issue.title, 50).padEnd(52);
  const stateStr = state ? formatState(state).padEnd(20) : chalk.gray('Unknown').padEnd(20);
  const assigneeStr = formatAssignee(assignee);
  
  return `${id} ${title} ${stateStr} ${assigneeStr}`;
}

/**
 * Options for issue detail formatting
 */
export interface FormatIssueDetailsOptions {
  comments?: Comment[];
}

/**
 * Format a detailed issue view
 */
export async function formatIssueDetails(issue: Issue, options?: FormatIssueDetailsOptions): Promise<string> {
  const state = await issue.state;
  const assignee = await issue.assignee;
  const team = await issue.team;
  const project = await issue.project;
  const labels = await issue.labels();

  const lines: string[] = [];

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
    } else {
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
export function printListHeader(): void {
  const header = chalk.bold(
    'ID'.padEnd(10) + ' ' +
    'Title'.padEnd(52) + ' ' +
    'Status'.padEnd(20) + ' ' +
    'Assignee'
  );
  console.log(header);
  console.log(chalk.gray('-'.repeat(100)));
}

/**
 * Format a comment for display
 */
export function formatComment(
  author: string,
  createdAt: Date,
  body: string,
  resolved?: boolean
): string {
  const lines: string[] = [];
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
export function formatSearchHighlight(text: string, query: string): string {
  if (!query) return text;

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, chalk.yellow.bold('$1'));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a progress bar
 */
export function formatProgressBar(current: number, total: number, width: number = 20): string {
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
export function formatBatchSummary(succeeded: number, failed: number, total: number): string {
  const lines: string[] = [];

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
export function formatStateWithIcon(state: WorkflowState): string {
  const icon = STATUS_ICONS[state.type] || '○';
  const colorFn = STATE_COLORS[state.type] || chalk.white;
  return colorFn(`${icon} ${state.name}`);
}

/**
 * Format priority with icon
 */
export function formatPriorityWithIcon(priority: number): string {
  const config = PRIORITY_MAP[priority] || PRIORITY_MAP[0];
  const icon = PRIORITY_ICONS[priority] || '   ';
  return config.color(`${icon} ${config.label}`);
}

/**
 * Create a horizontal divider
 */
export function divider(width: number = 60, char: string = '─'): string {
  return chalk.gray(char.repeat(width));
}

/**
 * Create a titled section divider
 */
export function sectionDivider(title: string, width: number = 60): string {
  const padding = Math.max(0, width - title.length - 4);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return chalk.gray('─'.repeat(leftPad) + '[ ') + chalk.bold(title) + chalk.gray(' ]' + '─'.repeat(rightPad));
}

/**
 * Format a label with its color (hex color support)
 */
export function formatLabel(name: string, hexColor?: string): string {
  if (hexColor) {
    try {
      return chalk.hex(hexColor).bold(` ${name} `);
    } catch {
      return chalk.magenta.bold(` ${name} `);
    }
  }
  return chalk.magenta.bold(` ${name} `);
}

/**
 * Format a colored label badge
 */
export function formatLabelBadge(name: string, hexColor?: string): string {
  if (hexColor) {
    try {
      const bg = chalk.bgHex(hexColor).black;
      return bg(` ${name} `);
    } catch {
      return chalk.bgMagenta.white(` ${name} `);
    }
  }
  return chalk.bgMagenta.white(` ${name} `);
}

/**
 * Format a key-value pair with consistent alignment
 */
export function formatKeyValue(key: string, value: string, keyWidth: number = 12): string {
  return chalk.gray(key.padEnd(keyWidth)) + value;
}

/**
 * Format an info box with a title
 */
export function formatInfoBox(title: string, lines: string[], width: number = 60): string {
  const result: string[] = [];
  const innerWidth = width - 4;

  // Top border with title
  const titlePadded = ` ${title} `;
  const topBorderLength = Math.max(0, width - titlePadded.length - 2);
  const leftBorder = Math.floor(topBorderLength / 2);
  const rightBorder = topBorderLength - leftBorder;

  result.push(
    chalk.gray(BOX.topLeft + BOX.horizontal.repeat(leftBorder)) +
    chalk.bold.cyan(titlePadded) +
    chalk.gray(BOX.horizontal.repeat(rightBorder) + BOX.topRight)
  );

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
export function formatSuccess(message: string): string {
  return chalk.green('✓ ') + message;
}

/**
 * Format an error message
 */
export function formatError(message: string): string {
  return chalk.red('✗ ') + message;
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return chalk.yellow('⚠ ') + message;
}

/**
 * Format an info message
 */
export function formatInfo(message: string): string {
  return chalk.blue('ℹ ') + message;
}

/**
 * Format a list of items with bullets
 */
export function formatBulletList(items: string[], indent: number = 2): string {
  const indentStr = ' '.repeat(indent);
  return items.map(item => `${indentStr}${chalk.gray('•')} ${item}`).join('\n');
}

/**
 * Format a numbered list
 */
export function formatNumberedList(items: string[], indent: number = 2): string {
  const indentStr = ' '.repeat(indent);
  return items.map((item, i) => `${indentStr}${chalk.cyan(`${i + 1}.`)} ${item}`).join('\n');
}

/**
 * Format a table row with columns
 */
export function formatTableRow(columns: string[], widths: number[]): string {
  return columns
    .map((col, i) => truncate(col, widths[i]).padEnd(widths[i]))
    .join(' ');
}

/**
 * Format a table header with columns
 */
export function formatTableHeader(columns: string[], widths: number[]): string {
  const header = columns
    .map((col, i) => chalk.bold(col.padEnd(widths[i])))
    .join(' ');
  const separator = widths.map(w => '─'.repeat(w)).join('─');
  return header + '\n' + chalk.gray(separator);
}

/**
 * Create a simple spinner-style indicator text
 */
export function formatSpinner(text: string): string {
  return chalk.cyan('◌ ') + chalk.gray(text + '...');
}

/**
 * Format time ago (e.g., "2 hours ago")
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(then);
}

/**
 * Export box characters for external use
 */
export { BOX, STATUS_ICONS, PRIORITY_ICONS };

