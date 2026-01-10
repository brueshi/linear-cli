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
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Timeout
    if (message.includes('timeout') || message.includes('timed out')) {
      return true;
    }

    // Server errors
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) {
      return true;
    }

    // Network errors
    if (message.includes('econnreset') || message.includes('econnrefused') ||
        message.includes('network') || message.includes('socket')) {
      return true;
    }

    // Temporarily unavailable
    if (message.includes('temporarily unavailable') || message.includes('try again')) {
      return true;
    }
  }

  // Check for status property on API errors
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status === 500 || status === 502 ||
           status === 503 || status === 504;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter (randomness) to prevent thundering herd
  const jitterAmount = cappedDelay * jitter * Math.random();

  return Math.floor(cappedDelay + jitterAmount);
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    jitter = 0.1,
    isRetryable = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt or non-retryable errors
      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay for this retry
      const delay = calculateDelay(attempt, baseDelay, maxDelay, jitter);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Create a retryable version of an async function
 *
 * @example
 * const retryableFetch = makeRetryable(fetchData, { maxRetries: 3 });
 * const result = await retryableFetch();
 */
export function makeRetryable<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: RetryOptions = {}
): (...args: Args) => Promise<T> {
  return (...args: Args) => withRetry(() => fn(...args), options);
}
