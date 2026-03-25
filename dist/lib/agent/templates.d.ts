/**
 * Agent template definition
 */
export interface AgentTemplate {
    /** Template name */
    name: string;
    /** Template pattern with placeholders like {title}, {team}, etc. */
    pattern: string;
    /** Default team key */
    teamKey?: string;
    /** Default priority */
    priority?: number;
    /** Default labels */
    labels?: string[];
    /** Default issue type */
    issueType?: 'bug' | 'feature' | 'improvement' | 'task';
    /** Description of the template */
    description?: string;
}
/**
 * Templates storage format
 */
interface TemplatesStore {
    templates: Record<string, AgentTemplate>;
}
/**
 * Template Manager - Manages agent templates for quick issue creation
 */
export declare const TemplateManager: {
    /**
     * Ensure templates directory exists
     */
    ensureDir(): void;
    /**
     * Load templates from disk
     */
    load(): TemplatesStore;
    /**
     * Save templates to disk
     */
    save(store: TemplatesStore): void;
    /**
     * Get a template by name
     */
    get(name: string): AgentTemplate | undefined;
    /**
     * List all templates
     */
    list(): AgentTemplate[];
    /**
     * Save a new template
     */
    set(template: AgentTemplate): void;
    /**
     * Delete a template
     */
    delete(name: string): boolean;
    /**
     * Apply a template to input
     */
    apply(templateName: string, variables: Record<string, string>): {
        input: string;
        template: AgentTemplate;
    } | null;
    /**
     * Get default templates
     */
    getDefaults(): Record<string, AgentTemplate>;
    /**
     * Reset templates to defaults
     */
    reset(): void;
};
/**
 * Parse template definition from string
 * Format: "name:pattern" or "name:pattern:team:priority"
 */
export declare function parseTemplateDefinition(definition: string): AgentTemplate | null;
export {};
