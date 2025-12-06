import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedIssueData, WorkspaceContext, AIClientConfig } from './types.js';
import { SYSTEM_PROMPT, buildUserPrompt, sanitizeInput } from './prompts.js';

/** Default configuration values */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * AI Client for extracting structured issue data using Claude
 */
export class AgentAIClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private timeout: number;

  constructor(config: AIClientConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    });
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
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
      // Handle specific error types
      if (error instanceof Anthropic.APIError) {
        if (error.status === 401) {
          throw new Error('Invalid Anthropic API key. Please check your configuration.');
        }
        if (error.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (error.status === 500 || error.status === 503) {
          throw new Error('Anthropic API is temporarily unavailable. Please try again later.');
        }
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      
      // Handle timeout
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('AI request timed out. Please try again.');
      }
      
      throw error;
    }
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
