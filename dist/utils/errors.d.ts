/**
 * Custom error types for better error handling
 */
export declare class LinearCliError extends Error {
    readonly hint?: string | undefined;
    readonly exitCode: number;
    constructor(message: string, hint?: string | undefined, exitCode?: number);
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
/**
 * Handle errors consistently across the CLI
 */
export declare function handleError(error: unknown): never;
/**
 * Wrap an async action with error handling
 */
export declare function withErrorHandling<T extends unknown[]>(fn: (...args: T) => Promise<void>): (...args: T) => Promise<void>;
