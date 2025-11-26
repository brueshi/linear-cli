import chalk from 'chalk';

/**
 * Custom error types for better error handling
 */

export class LinearCliError extends Error {
  constructor(
    message: string,
    public readonly hint?: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'LinearCliError';
  }
}

export class AuthenticationError extends LinearCliError {
  constructor(message: string = 'Not authenticated') {
    super(
      message,
      `Run ${chalk.cyan('linear auth login')} to authenticate.`,
      1
    );
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends LinearCliError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} "${identifier}" not found.`,
      undefined,
      1
    );
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends LinearCliError {
  constructor(message: string, hint?: string) {
    super(message, hint, 1);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends LinearCliError {
  constructor(message: string = 'Network request failed') {
    super(
      message,
      'Check your internet connection and try again.',
      1
    );
    this.name = 'NetworkError';
  }
}

/**
 * Handle errors consistently across the CLI
 */
export function handleError(error: unknown): never {
  // User cancelled prompt
  if (error instanceof Error && error.name === 'ExitPromptError') {
    console.log(chalk.gray('\nCancelled.'));
    process.exit(0);
  }

  // Our custom errors
  if (error instanceof LinearCliError) {
    console.log(chalk.red(error.message));
    if (error.hint) {
      console.log(chalk.gray(error.hint));
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
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error);
    }
  };
}

