import type { LinearClient } from '@linear/sdk';
import type { ExtractedIssueData, WorkspaceContext } from './types.js';
import { AgentAIClient } from './ai-client.js';
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
export declare class BatchProcessor {
    private aiClient;
    private issueParser;
    private validator;
    private linearClient;
    private context;
    private config;
    constructor(aiClient: AgentAIClient, linearClient: LinearClient, context: WorkspaceContext, config: Config);
    /**
     * Process a batch of inputs with parallel execution
     */
    processBatch(inputs: string[], options?: BatchOptions, onProgress?: (result: BatchItemResult, completed: number, total: number) => void): Promise<BatchResult>;
    /**
     * Process a single input item
     */
    private processItem;
    /**
     * Delay helper
     */
    private delay;
}
/**
 * Parse batch input from text (newline or semicolon separated)
 */
export declare function parseBatchInput(text: string): string[];
