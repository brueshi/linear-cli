import type { LinearClient } from '@linear/sdk';
import type { ExtractedIssueData, WorkspaceContext } from './types.js';
import { AgentAIClient } from './ai-client.js';
import { IssueParser } from './issue-parser.js';
import { Validator } from './validator.js';
import { resolveOrCreateLabels } from './labels.js';
import type { Config } from '../config.js';

/**
 * Processing phase for better error context
 */
export type ProcessingPhase = 'extracting' | 'validating' | 'resolving' | 'creating';

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

  /** Phase where error occurred */
  errorPhase?: ProcessingPhase;

  /** Extracted data (for dry run or debugging) */
  extracted?: ExtractedIssueData;

  /** Labels that were created */
  createdLabels?: string[];
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

  /** Total labels created across all issues */
  totalLabelsCreated: number;
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

  /** Delay between API calls (ms) - only used in sequential mode */
  delayMs?: number;

  /** Number of concurrent operations (default: 3) */
  concurrency?: number;

  /** Enable label auto-creation (default: true) */
  createLabels?: boolean;
}

/**
 * Batch Processor - Creates multiple issues from a list of inputs
 *
 * Supports processing multiple natural language inputs with:
 * - Parallel processing with configurable concurrency
 * - Label auto-creation
 * - Progress tracking and error handling
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
   * Process a batch of inputs with parallel execution
   */
  async processBatch(
    inputs: string[],
    options: BatchOptions = {},
    onProgress?: (result: BatchItemResult, completed: number, total: number) => void
  ): Promise<BatchResult> {
    const concurrency = options.concurrency ?? 3;
    const createLabels = options.createLabels ?? true;

    // Filter out empty lines and prepare work items
    const workItems = inputs
      .map((input, index) => ({ input: input.trim(), lineNumber: index + 1 }))
      .filter(item => item.input.length > 0);

    const results: BatchItemResult[] = [];
    let succeeded = 0;
    let failed = 0;
    let totalLabelsCreated = 0;
    let shouldStop = false;

    // Process in batches based on concurrency
    for (let i = 0; i < workItems.length && !shouldStop; i += concurrency) {
      const batch = workItems.slice(i, i + concurrency);

      // Process batch items in parallel
      const batchPromises = batch.map(async (item) => {
        if (shouldStop) {
          return {
            input: item.input,
            lineNumber: item.lineNumber,
            success: false,
            error: 'Processing stopped due to previous error',
          } as BatchItemResult;
        }

        return this.processItem(item.input, item.lineNumber, options, createLabels);
      });

      const batchResults = await Promise.all(batchPromises);

      // Process results and track progress
      for (const result of batchResults) {
        results.push(result);

        if (result.success) {
          succeeded++;
          if (result.createdLabels) {
            totalLabelsCreated += result.createdLabels.length;
          }
        } else {
          failed++;
          // Check if we should stop on error
          if (!options.continueOnError) {
            shouldStop = true;
          }
        }

        // Call progress callback
        if (onProgress) {
          onProgress(result, results.length, workItems.length);
        }
      }

      // Small delay between batches to avoid overwhelming the API
      if (i + concurrency < workItems.length && !shouldStop) {
        await this.delay(options.delayMs ?? 200);
      }
    }

    return {
      total: results.length,
      succeeded,
      failed,
      items: results,
      totalLabelsCreated,
    };
  }

  /**
   * Process a single input item
   */
  private async processItem(
    input: string,
    lineNumber: number,
    options: BatchOptions,
    createLabels: boolean
  ): Promise<BatchItemResult> {
    let phase: ProcessingPhase = 'extracting';

    try {
      // Phase 1: Extract issue data using AI
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

      // Phase 2: Validate
      phase = 'validating';
      const validation = this.validator.validate(extracted, this.context);
      if (!validation.valid) {
        return {
          input,
          lineNumber,
          success: false,
          error: validation.errors.join('; '),
          errorPhase: phase,
          extracted,
        };
      }

      // Apply enriched data
      if (validation.enriched.teamId) {
        extracted.teamId = validation.enriched.teamId;
      }

      // Phase 3: Resolve team and labels
      phase = 'resolving';
      const parseResult = this.issueParser.parse(extracted, this.context, this.config);

      if (!parseResult.team) {
        return {
          input,
          lineNumber,
          success: false,
          error: 'Could not resolve team',
          errorPhase: phase,
          extracted,
        };
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

      // Resolve and optionally create labels
      let labelIds: string[] | undefined;
      let createdLabels: string[] | undefined;

      if (extracted.labels && extracted.labels.length > 0) {
        if (createLabels) {
          // Use full label resolution with auto-creation
          const labelResult = await resolveOrCreateLabels(
            this.linearClient,
            extracted.labels,
            this.context.labels,
            parseResult.team.id
          );
          labelIds = labelResult.labelIds.length > 0 ? labelResult.labelIds : undefined;
          createdLabels = labelResult.createdLabels.length > 0 ? labelResult.createdLabels : undefined;

          // Update context with newly created labels for subsequent items
          if (labelResult.createdLabels.length > 0) {
            for (let i = 0; i < labelResult.createdLabels.length; i++) {
              const newLabel = {
                id: labelResult.labelIds[labelResult.existingLabels.length + i],
                name: labelResult.createdLabels[i],
              };
              // Add to context so subsequent items can use it
              if (!this.context.labels.find(l => l.id === newLabel.id)) {
                this.context.labels.push(newLabel);
              }
            }
          }
        } else {
          // Only match existing labels
          const resolvedLabels = this.context.labels.filter(l =>
            extracted.labels!.some(name =>
              l.name.toLowerCase() === name.toLowerCase()
            )
          );
          if (resolvedLabels.length > 0) {
            labelIds = resolvedLabels.map(l => l.id);
          }
        }
      }

      // Phase 4: Create issue
      phase = 'creating';
      const issuePayload = await this.linearClient.createIssue({
        teamId: parseResult.team.id,
        title: extracted.title,
        description: extracted.description,
        priority: extracted.priority,
        estimate: extracted.estimate,
        labelIds,
        assigneeId: extracted.assigneeId,
        dueDate: extracted.dueDate,
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
          createdLabels,
        };
      } else {
        return {
          input,
          lineNumber,
          success: false,
          error: 'Failed to create issue - no response from API',
          errorPhase: phase,
          extracted,
        };
      }
    } catch (error) {
      return {
        input,
        lineNumber,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorPhase: phase,
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
 * Parse batch input from text (newline or semicolon separated)
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
