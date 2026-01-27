import { ExitCodes } from './json-output.js';
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
export declare class LinearCliError extends Error {
    readonly hint?: string | undefined;
    readonly exitCode: number;
    readonly errorCode?: string | undefined;
    constructor(message: string, hint?: string | undefined, exitCode?: number, errorCode?: string | undefined);
}
export declare class AuthenticationError extends LinearCliError {
    constructor(message?: string);
}
export declare class NotFoundError extends LinearCliError {
    constructor(resource: string, identifier: string);
}
export declare class ValidationError extends LinearCliError {
    constructor(message: string, hint?: string);
}
export declare class NetworkError extends LinearCliError {
    constructor(message?: string);
}
export declare class RateLimitError extends LinearCliError {
    constructor(message?: string);
}
export declare class AnthropicAuthError extends LinearCliError {
    constructor();
}
export declare class AIExtractionError extends LinearCliError {
    constructor(message?: string);
}
export declare class AIRateLimitError extends LinearCliError {
    constructor();
}
export declare class AITimeoutError extends LinearCliError {
    constructor();
}
export declare class TeamNotFoundError extends LinearCliError {
    constructor(teamKey: string, availableTeams: string[]);
}
export declare class AgentValidationError extends LinearCliError {
    constructor(errors: string[], suggestions?: string[]);
}
/**
 * Handle errors consistently across the CLI
 * Supports JSON output mode for machine-readable errors
 */
export declare function handleError(error: unknown): never;
/**
 * Wrap an async action with error handling
 */
export declare function withErrorHandling<T extends unknown[]>(fn: (...args: T) => Promise<void>): (...args: T) => Promise<void>;
