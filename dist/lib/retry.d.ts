/**
 * Retry utility with exponential backoff and jitter
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in milliseconds (default: 1000) */
    baseDelay?: number;
    /** Maximum delay in milliseconds (default: 10000) */
    maxDelay?: number;
    /** Jitter factor 0-1 to add randomness (default: 0.1) */
    jitter?: number;
    /** Function to determine if error is retryable */
    isRetryable?: (error: unknown) => boolean;
    /** Callback for retry attempts */
    onRetry?: (attempt: number, error: unknown, delay: number) => void;
}
/**
 * Default function to determine if an error is retryable
 */
export declare function isRetryableError(error: unknown): boolean;
/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Create a retryable version of an async function
 *
 * @example
 * const retryableFetch = makeRetryable(fetchData, { maxRetries: 3 });
 * const result = await retryableFetch();
 */
export declare function makeRetryable<T, Args extends unknown[]>(fn: (...args: Args) => Promise<T>, options?: RetryOptions): (...args: Args) => Promise<T>;
