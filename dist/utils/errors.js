import chalk from 'chalk';
/**
 * Custom error types for better error handling
 */
export class LinearCliError extends Error {
    hint;
    exitCode;
    constructor(message, hint, exitCode = 1) {
        super(message);
        this.hint = hint;
        this.exitCode = exitCode;
        this.name = 'LinearCliError';
    }
}
export class AuthenticationError extends LinearCliError {
    constructor(message = 'Not authenticated') {
        super(message, `Run ${chalk.cyan('linear auth login')} to authenticate.`, 1);
        this.name = 'AuthenticationError';
    }
}
export class NotFoundError extends LinearCliError {
    constructor(resource, identifier) {
        super(`${resource} "${identifier}" not found.`, undefined, 1);
        this.name = 'NotFoundError';
    }
}
export class ValidationError extends LinearCliError {
    constructor(message, hint) {
        super(message, hint, 1);
        this.name = 'ValidationError';
    }
}
export class NetworkError extends LinearCliError {
    constructor(message = 'Network request failed') {
        super(message, 'Check your internet connection and try again.', 1);
        this.name = 'NetworkError';
    }
}
// ─────────────────────────────────────────────────────────────────
// Agent-specific errors
// ─────────────────────────────────────────────────────────────────
export class AnthropicAuthError extends LinearCliError {
    constructor() {
        super('Anthropic API key not found', `To use the agent command, configure your API key:\n` +
            `  ${chalk.cyan('linear agent-auth <your-api-key>')}\n\n` +
            `Get your key at: ${chalk.cyan('https://console.anthropic.com/settings/keys')}`, 1);
        this.name = 'AnthropicAuthError';
    }
}
export class AIExtractionError extends LinearCliError {
    constructor(message = 'Failed to extract issue data from input') {
        super(message, `Try being more specific about what you want to create.\n` +
            `Example: ${chalk.cyan('linear agent "Fix login bug on Safari, backend team, urgent"')}`, 1);
        this.name = 'AIExtractionError';
    }
}
export class AIRateLimitError extends LinearCliError {
    constructor() {
        super('AI rate limit exceeded', 'Please wait a moment and try again.', 1);
        this.name = 'AIRateLimitError';
    }
}
export class AITimeoutError extends LinearCliError {
    constructor() {
        super('AI request timed out', 'The AI service is taking too long. Please try again.', 1);
        this.name = 'AITimeoutError';
    }
}
export class TeamNotFoundError extends LinearCliError {
    constructor(teamKey, availableTeams) {
        const teamList = availableTeams.length > 0
            ? `Available teams: ${availableTeams.join(', ')}`
            : 'No teams found in workspace';
        super(`Team "${teamKey}" not found`, `${teamList}\n` +
            `Use ${chalk.cyan('--team <key>')} to specify a team.`, 1);
        this.name = 'TeamNotFoundError';
    }
}
export class AgentValidationError extends LinearCliError {
    constructor(errors, suggestions = []) {
        const message = errors.join('\n');
        const hint = suggestions.length > 0
            ? suggestions.join('\n')
            : undefined;
        super(message, hint, 1);
        this.name = 'AgentValidationError';
    }
}
/**
 * Handle errors consistently across the CLI
 */
export function handleError(error) {
    // User cancelled prompt
    if (error instanceof Error && error.name === 'ExitPromptError') {
        console.log(chalk.gray('\nCancelled.'));
        process.exit(0);
    }
    // Our custom errors
    if (error instanceof LinearCliError) {
        console.log(chalk.red(error.message));
        if (error.hint) {
            console.log('');
            console.log(error.hint);
        }
        process.exit(error.exitCode);
    }
    // Linear API errors
    if (error instanceof Error) {
        const message = error.message;
        // Network/connection errors
        if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
            console.log(chalk.red('Unable to connect to Linear API.'));
            console.log(chalk.gray('Check your internet connection and try again.'));
            process.exit(1);
        }
        // Authentication errors from API
        if (message.includes('401') || message.includes('Unauthorized') || message.includes('authentication')) {
            console.log(chalk.red('Authentication failed.'));
            console.log(chalk.gray(`Your API key may be invalid or expired. Run ${chalk.cyan('linear auth login')} to re-authenticate.`));
            process.exit(1);
        }
        // Rate limiting
        if (message.includes('429') || message.includes('rate limit')) {
            console.log(chalk.red('Rate limit exceeded.'));
            console.log(chalk.gray('Please wait a moment and try again.'));
            process.exit(1);
        }
        // Anthropic API errors
        if (message.includes('Anthropic') || message.includes('Claude')) {
            console.log(chalk.red('AI service error.'));
            console.log(chalk.gray(message));
            process.exit(1);
        }
        // Generic error
        console.log(chalk.red('An error occurred.'));
        console.log(chalk.gray(message));
        process.exit(1);
    }
    // Unknown error
    console.log(chalk.red('An unexpected error occurred.'));
    process.exit(1);
}
/**
 * Wrap an async action with error handling
 */
export function withErrorHandling(fn) {
    return async (...args) => {
        try {
            await fn(...args);
        }
        catch (error) {
            handleError(error);
        }
    };
}
