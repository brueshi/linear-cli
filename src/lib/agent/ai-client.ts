import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedIssueData, WorkspaceContext, AIClientConfig } from './types.js';
import { SYSTEM_PROMPT, buildUserPrompt, sanitizeInput } from './prompts.js';
import { withRetry } from '../retry.js';

/** Default configuration values */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY = 1000; // 1 second

/**
 * AI Client for extracting structured issue data using Claude
 */
export class AgentAIClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private timeout: number;
  private maxRetries: number;
  private retryBaseDelay: number;

  constructor(config: AIClientConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    });
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelay = config.retryBaseDelay ?? DEFAULT_RETRY_BASE_DELAY;
  }

  /**
   * Extract structured issue data from natural language input
   */
  async extractIssueData(
    input: string,
    context?: WorkspaceContext
  ): Promise<ExtractedIssueData> {
    // Sanitize input to prevent prompt injection
    const sanitizedInput = sanitizeInput(input);

    if (!sanitizedInput) {
      throw new Error('Input is empty after sanitization');
    }

    // Build the user prompt with optional context
    const userPrompt = buildUserPrompt(sanitizedInput, context);

    // Use retry logic for transient failures
    return withRetry(
      async () => {
        try {
          const response = await this.client.messages.create({
            model: this.model,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: userPrompt,
              },
            ],
          });

          // Extract text content from response
          const content = response.content[0];
          if (content.type !== 'text') {
            throw new Error('Unexpected response type from Claude');
          }

          // Parse the JSON response
          return this.parseJsonResponse(content.text);
        } catch (error) {
          // Handle specific error types and determine if retryable
          if (error instanceof Anthropic.APIError) {
            if (error.status === 401) {
              // Auth errors are not retryable
              throw new Error('Invalid Anthropic API key. Please check your configuration.');
            }
            if (error.status === 429) {
              // Rate limit - retryable, rethrow to trigger retry
              const retryableError = new Error('Rate limit exceeded (429)');
              (retryableError as Error & { status: number }).status = 429;
              throw retryableError;
            }
            if (error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504) {
              // Server errors - retryable
              const retryableError = new Error(`Anthropic API temporarily unavailable (${error.status})`);
              (retryableError as Error & { status: number }).status = error.status;
              throw retryableError;
            }
            throw new Error(`Anthropic API error: ${error.message}`);
          }

          // Handle timeout - retryable
          if (error instanceof Error && error.message.includes('timeout')) {
            const timeoutError = new Error('AI request timed out');
            (timeoutError as Error & { retryable: boolean }).retryable = true;
            throw timeoutError;
          }

          throw error;
        }
      },
      {
        maxRetries: this.maxRetries,
        baseDelay: this.retryBaseDelay,
        maxDelay: 10000,
        jitter: 0.2,
        isRetryable: (error) => {
          if (error instanceof Error) {
            // Check for status codes that indicate retryable errors
            if ('status' in error) {
              const status = (error as Error & { status: number }).status;
              return status === 429 || status >= 500;
            }
            // Check for timeout
            if (error.message.includes('timeout') || error.message.includes('timed out')) {
              return true;
            }
          }
          return false;
        },
      }
    );
  }

  /**
   * Parse JSON response from Claude into ExtractedIssueData
   */
  private parseJsonResponse(text: string): ExtractedIssueData {
    // Clean up the response text
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    try {
      const parsed = JSON.parse(jsonText);
      
      // Validate required fields
      if (!parsed.title || typeof parsed.title !== 'string') {
        throw new Error('AI response missing required "title" field');
      }

      // Build the extracted data with type safety
      const extracted: ExtractedIssueData = {
        title: parsed.title.trim(),
      };

      // Add optional fields if present and valid
      if (parsed.description && typeof parsed.description === 'string') {
        extracted.description = parsed.description.trim();
      }

      if (parsed.teamKey && typeof parsed.teamKey === 'string') {
        extracted.teamKey = parsed.teamKey.toUpperCase().trim();
      }

      if (typeof parsed.priority === 'number' && parsed.priority >= 0 && parsed.priority <= 4) {
        extracted.priority = parsed.priority;
      }

      if (typeof parsed.estimate === 'number' && parsed.estimate > 0) {
        extracted.estimate = parsed.estimate;
      }

      if (Array.isArray(parsed.labels)) {
        extracted.labels = parsed.labels
          .filter((l: unknown) => typeof l === 'string')
          .map((l: string) => l.trim().toLowerCase());
      }

      if (parsed.issueType && ['bug', 'feature', 'improvement', 'task'].includes(parsed.issueType)) {
        extracted.issueType = parsed.issueType;
      }

      if (parsed.dueDate && typeof parsed.dueDate === 'string') {
        // Validate ISO date format
        const date = new Date(parsed.dueDate);
        if (!isNaN(date.getTime())) {
          extracted.dueDate = parsed.dueDate;
        }
      }

      return extracted;
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        throw new Error(`Failed to parse AI response as JSON: ${jsonText.slice(0, 100)}...`);
      }
      throw parseError;
    }
  }
}
