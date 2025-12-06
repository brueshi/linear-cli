import type { LinearClient } from '@linear/sdk';
import type { ExtractedIssueData, WorkspaceContext } from './types.js';
import { AgentAIClient } from './ai-client.js';
import { IssueParser } from './issue-parser.js';
import { Validator } from './validator.js';
import type { Config } from '../config.js';

/**
 * Result of processing a single item in a batch
 */
export interface BatchItemResult {
  /** Original input line */
  input: string;
  
  /** Line number (1-indexed) */
  lineNumber: number;
  
  /** Whether the issue was created successfully */
  success: boolean;
  
  /** Created issue identifier (e.g., "ATT-123") */
  issueIdentifier?: string;
  
  /** Created issue URL */
  issueUrl?: string;
  
  /** Error message if failed */
  error?: string;
  
  /** Extracted data (for dry run) */
  extracted?: ExtractedIssueData;
}

/**
 * Result of batch processing
 */
export interface BatchResult {
  /** Total items processed */
  total: number;
  
  /** Successfully created */
  succeeded: number;
  
  /** Failed to create */
  failed: number;
  
  /** Individual results */
  items: BatchItemResult[];
}

/**
 * Options for batch processing
 */
export interface BatchOptions {
  /** Team key override */
  teamKey?: string;
  
  /** Priority override */
  priority?: number;
  
  /** Assign to user ID */
  assigneeId?: string;
  
  /** Dry run mode */
  dryRun?: boolean;
  
  /** Continue on error */
  continueOnError?: boolean;
  
  /** Delay between API calls (ms) */
  delayMs?: number;
}

/**
 * Batch Processor - Creates multiple issues from a list of inputs
 * 
 * Supports processing multiple natural language inputs in sequence,
 * with error handling and progress tracking.
 */
export class BatchProcessor {
  private aiClient: AgentAIClient;
  private issueParser: IssueParser;
  private validator: Validator;
  private linearClient: LinearClient;
  private context: WorkspaceContext;
  private config: Config;

  constructor(
    aiClient: AgentAIClient,
    linearClient: LinearClient,
    context: WorkspaceContext,
    config: Config
  ) {
    this.aiClient = aiClient;
    this.linearClient = linearClient;
    this.context = context;
    this.config = config;
    this.issueParser = new IssueParser();
    this.validator = new Validator();
  }

  /**
   * Process a batch of inputs
   */
  async processBatch(
    inputs: string[],
    options: BatchOptions = {},
    onProgress?: (result: BatchItemResult) => void
  ): Promise<BatchResult> {
    const results: BatchItemResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i].trim();
      
      // Skip empty lines
      if (!input) {
        continue;
      }

      const result = await this.processItem(input, i + 1, options);
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }

      // Call progress callback
      if (onProgress) {
        onProgress(result);
      }

      // Stop on error if not continuing
      if (!result.success && !options.continueOnError) {
        break;
      }

      // Delay between API calls to avoid rate limiting
      if (options.delayMs && i < inputs.length - 1) {
        await this.delay(options.delayMs);
      }
    }

    return {
      total: results.length,
      succeeded,
      failed,
      items: results,
    };
  }

  /**
   * Process a single input item
   */
  private async processItem(
    input: string,
    lineNumber: number,
    options: BatchOptions
  ): Promise<BatchItemResult> {
    try {
      // Extract issue data using AI
      let extracted = await this.aiClient.extractIssueData(input, this.context);

      // Apply overrides
      if (options.teamKey) {
        extracted.teamKey = options.teamKey;
      }
      if (options.priority !== undefined) {
        extracted.priority = options.priority;
      }
      if (options.assigneeId) {
        extracted.assigneeId = options.assigneeId;
      }

      // Apply defaults
      extracted = this.issueParser.applyDefaults(extracted, this.context, this.config);

      // Validate
      const validation = this.validator.validate(extracted, this.context);
      if (!validation.valid) {
        return {
          input,
          lineNumber,
          success: false,
          error: validation.errors.join('; '),
          extracted,
        };
      }

      // Apply enriched data
      if (validation.enriched.teamId) {
        extracted.teamId = validation.enriched.teamId;
      }

      // Dry run - don't create
      if (options.dryRun) {
        return {
          input,
          lineNumber,
          success: true,
          extracted,
        };
      }

      // Parse to Linear format
      const parseResult = this.issueParser.parse(extracted, this.context, this.config);
      
      if (!parseResult.team) {
        return {
          input,
          lineNumber,
          success: false,
          error: 'Could not resolve team',
          extracted,
        };
      }

      // Resolve labels
      let labelIds: string[] | undefined;
      if (extracted.labels && extracted.labels.length > 0) {
        const resolvedLabels = this.context.labels.filter(l =>
          extracted.labels!.some(name => 
            l.name.toLowerCase() === name.toLowerCase()
          )
        );
        if (resolvedLabels.length > 0) {
          labelIds = resolvedLabels.map(l => l.id);
        }
      }

      // Create issue
      const issuePayload = await this.linearClient.createIssue({
        teamId: parseResult.team.id,
        title: extracted.title,
        description: extracted.description,
        priority: extracted.priority,
        estimate: extracted.estimate,
        labelIds,
        assigneeId: extracted.assigneeId,
      });

      const createdIssue = await issuePayload.issue;

      if (createdIssue) {
        return {
          input,
          lineNumber,
          success: true,
          issueIdentifier: createdIssue.identifier,
          issueUrl: createdIssue.url,
          extracted,
        };
      } else {
        return {
          input,
          lineNumber,
          success: false,
          error: 'Failed to create issue',
          extracted,
        };
      }
    } catch (error) {
      return {
        input,
        lineNumber,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse batch input from text (newline or comma separated)
 */
export function parseBatchInput(text: string): string[] {
  // Split by newlines first
  let lines = text.split(/\r?\n/);
  
  // If only one line, try splitting by semicolons (not commas, as commas are common in descriptions)
  if (lines.length === 1 && lines[0].includes(';')) {
    lines = lines[0].split(';');
  }
  
  // Filter empty lines and trim
  return lines
    .map(line => line.trim())
    .filter(line => line.length > 0);
}
