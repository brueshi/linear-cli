import type { ExtractedIssueData, WorkspaceContext } from './types.js';
import type { Config } from '../config.js';
/**
 * Input format for Linear SDK createIssue
 */
export interface LinearIssueInput {
    teamId: string;
    title: string;
    description?: string;
    priority?: number;
    estimate?: number;
    labelIds?: string[];
    projectId?: string;
    assigneeId?: string;
    dueDate?: string;
}
/**
 * Result of parsing extracted data
 */
export interface ParseResult {
    /** Linear-ready issue input */
    input: LinearIssueInput;
    /** Resolved team information */
    team: {
        id: string;
        key: string;
        name: string;
    } | null;
    /** Resolved labels */
    labels: Array<{
        id: string;
        name: string;
    }>;
    /** Warnings about unresolved data */
    warnings: string[];
}
/**
 * Issue Parser - Converts AI-extracted data to Linear SDK format
 *
 * Handles resolution of team keys to IDs, label names to IDs,
 * and applies intelligent defaults from config and workspace patterns.
 */
export declare class IssueParser {
    /**
     * Parse extracted issue data into Linear SDK format
     */
    parse(extracted: ExtractedIssueData, context: WorkspaceContext, config: Config): ParseResult;
    /**
     * Resolve team from extracted data, config defaults, or workspace patterns
     */
    private resolveTeam;
    /**
     * Find team by key (case-insensitive)
     */
    private findTeamByKey;
    /**
     * Find team by name pattern (handles common aliases)
     */
    private findTeamByNamePattern;
    /**
     * Infer team from recent issue patterns
     */
    private inferTeamFromPatterns;
    /**
     * Resolve label names to label objects
     */
    private resolveLabels;
    /**
     * Apply intelligent defaults to extracted data
     */
    applyDefaults(extracted: ExtractedIssueData, context: WorkspaceContext, config: Config): ExtractedIssueData;
    /**
     * Infer issue type from title and description keywords
     */
    private inferIssueType;
}
