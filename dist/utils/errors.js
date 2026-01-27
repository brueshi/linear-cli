import chalk from 'chalk';
import { ExitCodes, isJsonMode, outputJsonError } from './json-output.js';
/**
 * Exit codes for consistent error handling
 *
 * 0: Success
 * 1: General error
 * 2: Auth failure
 * 3: Not found
 * 4: Rate limited
 * 5: Validation error
 */
export { ExitCodes };
/**
 * Custom error types for better error handling
 */
export class LinearCliError extends Error {
    hint;
    exitCode;
    errorCode;
    constructor(message, hint, exitCode = ExitCodes.GENERAL_ERROR, errorCode) {
        super(message);
        this.hint = hint;
        this.exitCode = exitCode;
        this.errorCode = errorCode;
        this.name = 'LinearCliError';
    }
}
export class AuthenticationError extends LinearCliError {
    constructor(message = 'Not authenticated') {
        super(message, `Run ${chalk.cyan('linear auth login')} to authenticate.`, ExitCodes.AUTH_FAILURE, 'AUTH_REQUIRED');
        this.name = 'AuthenticationError';
    }
}
export class NotFoundError extends LinearCliError {
    constructor(resource, identifier) {
        super(`${resource} "${identifier}" not found.`, undefined, ExitCodes.NOT_FOUND, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
export class ValidationError extends LinearCliError {
    constructor(message, hint) {
        super(message, hint, ExitCodes.VALIDATION_ERROR, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}
export class NetworkError extends LinearCliError {
    constructor(message = 'Network request failed') {
        super(message, 'Check your internet connection and try again.', ExitCodes.GENERAL_ERROR, 'NETWORK_ERROR');
        this.name = 'NetworkError';
    }
}
export class RateLimitError extends LinearCliError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 'Please wait a moment and try again.', ExitCodes.RATE_LIMITED, 'RATE_LIMITED');
        this.name = 'RateLimitError';
    }
}
// ─────────────────────────────────────────────────────────────────
// Agent-specific errors
// ─────────────────────────────────────────────────────────────────
export class AnthropicAuthError extends LinearCliError {
    constructor() {
        super('Anthropic API key not found', `To use the agent command, configure your API key:\n` +
            `  ${chalk.cyan('linear agent-auth <your-api-key>')}\n\n` +
            `Get your key at: ${chalk.cyan('https://console.anthropic.com/settings/keys')}`, ExitCodes.AUTH_FAILURE, 'ANTHROPIC_AUTH_REQUIRED');
        this.name = 'AnthropicAuthError';
    }
}
export class AIExtractionError extends LinearCliError {
    constructor(message = 'Failed to extract issue data from input') {
        super(message, `Try being more specific about what you want to create.\n` +
            `Example: ${chalk.cyan('linear agent "Fix login bug on Safari, backend team, urgent"')}`, ExitCodes.GENERAL_ERROR, 'AI_EXTRACTION_FAILED');
        this.name = 'AIExtractionError';
    }
}
export class AIRateLimitError extends LinearCliError {
    constructor() {
        super('AI rate limit exceeded', 'Please wait a moment and try again.', ExitCodes.RATE_LIMITED, 'AI_RATE_LIMITED');
        this.name = 'AIRateLimitError';
    }
}
export class AITimeoutError extends LinearCliError {
    constructor() {
        super('AI request timed out', 'The AI service is taking too long. Please try again.', ExitCodes.GENERAL_ERROR, 'AI_TIMEOUT');
        this.name = 'AITimeoutError';
    }
}
export class TeamNotFoundError extends LinearCliError {
    constructor(teamKey, availableTeams) {
        const teamList = availableTeams.length > 0
            ? `Available teams: ${availableTeams.join(', ')}`
            : 'No teams found in workspace';
        super(`Team "${teamKey}" not found`, `${teamList}\n` +
            `Use ${chalk.cyan('--team <key>')} to specify a team.`, ExitCodes.NOT_FOUND, 'TEAM_NOT_FOUND');
        this.name = 'TeamNotFoundError';
    }
}
export class AgentValidationError extends LinearCliError {
    constructor(errors, suggestions = []) {
        const message = errors.join('\n');
        const hint = suggestions.length > 0
            ? suggestions.join('\n')
            : undefined;
        super(message, hint, ExitCodes.VALIDATION_ERROR, 'AGENT_VALIDATION_ERROR');
        this.name = 'AgentValidationError';
    }
}
/**
 * Handle errors consistently across the CLI
 * Supports JSON output mode for machine-readable errors
 */
export function handleError(error) {
    // User cancelled prompt
    if (error instanceof Error && error.name === 'ExitPromptError') {
        if (!isJsonMode()) {
            console.log(chalk.gray('\nCancelled.'));
        }
        process.exit(ExitCodes.SUCCESS);
    }
    // Our custom errors
    if (error instanceof LinearCliError) {
        if (isJsonMode()) {
            outputJsonError(error.errorCode || 'ERROR', error.message);
            process.exit(error.exitCode);
        }
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
            if (isJsonMode()) {
                outputJsonError('NETWORK_ERROR', 'Unable to connect to Linear API');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Unable to connect to Linear API.'));
            console.log(chalk.gray('Check your internet connection and try again.'));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
        // Authentication errors from API
        if (message.includes('401') || message.includes('Unauthorized') || message.includes('authentication')) {
            if (isJsonMode()) {
                outputJsonError('AUTH_FAILED', 'Authentication failed');
                process.exit(ExitCodes.AUTH_FAILURE);
            }
            console.log(chalk.red('Authentication failed.'));
            console.log(chalk.gray(`Your API key may be invalid or expired. Run ${chalk.cyan('linear auth login')} to re-authenticate.`));
            process.exit(ExitCodes.AUTH_FAILURE);
        }
        // Rate limiting
        if (message.includes('429') || message.includes('rate limit')) {
            if (isJsonMode()) {
                outputJsonError('RATE_LIMITED', 'Rate limit exceeded');
                process.exit(ExitCodes.RATE_LIMITED);
            }
            console.log(chalk.red('Rate limit exceeded.'));
            console.log(chalk.gray('Please wait a moment and try again.'));
            process.exit(ExitCodes.RATE_LIMITED);
        }
        // Anthropic API errors
        if (message.includes('Anthropic') || message.includes('Claude')) {
            if (isJsonMode()) {
                outputJsonError('AI_ERROR', message);
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('AI service error.'));
            console.log(chalk.gray(message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
        // Generic error
        if (isJsonMode()) {
            outputJsonError('ERROR', message);
            process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('An error occurred.'));
        console.log(chalk.gray(message));
        process.exit(ExitCodes.GENERAL_ERROR);
    }
    // Unknown error
    if (isJsonMode()) {
        outputJsonError('UNKNOWN_ERROR', 'An unexpected error occurred');
        process.exit(ExitCodes.GENERAL_ERROR);
    }
    console.log(chalk.red('An unexpected error occurred.'));
    process.exit(ExitCodes.GENERAL_ERROR);
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
