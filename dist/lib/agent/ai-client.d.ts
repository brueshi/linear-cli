import type { ExtractedIssueData, ExtractedUpdateData, WorkspaceContext, AIClientConfig } from './types.js';
/**
 * AI Client for extracting structured issue data using Claude
 */
export declare class AgentAIClient {
    private client;
    private model;
    private maxTokens;
    private temperature;
    private timeout;
    private maxRetries;
    private retryBaseDelay;
    constructor(config: AIClientConfig);
    /**
     * Extract structured issue data from natural language input
     */
    extractIssueData(input: string, context?: WorkspaceContext): Promise<ExtractedIssueData>;
    /**
     * Extract structured update data from natural language input
     */
    extractUpdateData(input: string, issueContext: {
        identifier: string;
        title: string;
        currentStatus: string;
    }, workspaceContext?: WorkspaceContext): Promise<ExtractedUpdateData>;
    /**
     * Parse JSON response from Claude into ExtractedUpdateData
     */
    private parseUpdateJsonResponse;
    /**
     * Parse JSON response from Claude into ExtractedIssueData
     */
    private parseJsonResponse;
}
