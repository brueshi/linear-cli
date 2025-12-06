import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const TEMPLATES_DIR = join(homedir(), '.config', 'linear-cli');
const TEMPLATES_FILE = join(TEMPLATES_DIR, 'agent-templates.json');

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
 * Default templates
 */
const DEFAULT_TEMPLATES: Record<string, AgentTemplate> = {
  bug: {
    name: 'bug',
    pattern: 'Fix {title}',
    priority: 2,
    issueType: 'bug',
    description: 'Quick bug report template',
  },
  feature: {
    name: 'feature',
    pattern: 'Add {title}',
    priority: 3,
    issueType: 'feature',
    description: 'New feature template',
  },
  task: {
    name: 'task',
    pattern: '{title}',
    priority: 4,
    issueType: 'task',
    description: 'General task template',
  },
  urgent: {
    name: 'urgent',
    pattern: '[URGENT] {title}',
    priority: 1,
    issueType: 'bug',
    description: 'Urgent issue template',
  },
};

/**
 * Template Manager - Manages agent templates for quick issue creation
 */
export const TemplateManager = {
  /**
   * Ensure templates directory exists
   */
  ensureDir(): void {
    if (!existsSync(TEMPLATES_DIR)) {
      mkdirSync(TEMPLATES_DIR, { recursive: true });
    }
  },

  /**
   * Load templates from disk
   */
  load(): TemplatesStore {
    try {
      if (existsSync(TEMPLATES_FILE)) {
        const content = readFileSync(TEMPLATES_FILE, 'utf-8');
        const stored = JSON.parse(content) as TemplatesStore;
        // Merge with defaults
        return {
          templates: { ...DEFAULT_TEMPLATES, ...stored.templates },
        };
      }
    } catch {
      // Return defaults if file is corrupted
    }
    return { templates: { ...DEFAULT_TEMPLATES } };
  },

  /**
   * Save templates to disk
   */
  save(store: TemplatesStore): void {
    this.ensureDir();
    // Only save non-default templates
    const customTemplates: Record<string, AgentTemplate> = {};
    for (const [name, template] of Object.entries(store.templates)) {
      if (!DEFAULT_TEMPLATES[name] || JSON.stringify(template) !== JSON.stringify(DEFAULT_TEMPLATES[name])) {
        customTemplates[name] = template;
      }
    }
    writeFileSync(TEMPLATES_FILE, JSON.stringify({ templates: customTemplates }, null, 2));
  },

  /**
   * Get a template by name
   */
  get(name: string): AgentTemplate | undefined {
    const store = this.load();
    return store.templates[name.toLowerCase()];
  },

  /**
   * List all templates
   */
  list(): AgentTemplate[] {
    const store = this.load();
    return Object.values(store.templates);
  },

  /**
   * Save a new template
   */
  set(template: AgentTemplate): void {
    const store = this.load();
    store.templates[template.name.toLowerCase()] = template;
    this.save(store);
  },

  /**
   * Delete a template
   */
  delete(name: string): boolean {
    const store = this.load();
    const lowerName = name.toLowerCase();
    
    // Don't allow deleting default templates
    if (DEFAULT_TEMPLATES[lowerName]) {
      return false;
    }
    
    if (store.templates[lowerName]) {
      delete store.templates[lowerName];
      this.save(store);
      return true;
    }
    return false;
  },

  /**
   * Apply a template to input
   */
  apply(templateName: string, variables: Record<string, string>): {
    input: string;
    template: AgentTemplate;
  } | null {
    const template = this.get(templateName);
    if (!template) {
      return null;
    }

    // Replace placeholders in pattern
    let input = template.pattern;
    for (const [key, value] of Object.entries(variables)) {
      input = input.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
    }

    // Add team if specified
    if (template.teamKey) {
      input += `, ${template.teamKey} team`;
    }

    // Add priority keywords
    if (template.priority !== undefined) {
      const priorityKeywords = ['', 'urgent', 'high priority', 'medium priority', 'low priority'];
      if (priorityKeywords[template.priority]) {
        input += `, ${priorityKeywords[template.priority]}`;
      }
    }

    return { input, template };
  },

  /**
   * Get default templates
   */
  getDefaults(): Record<string, AgentTemplate> {
    return { ...DEFAULT_TEMPLATES };
  },

  /**
   * Reset templates to defaults
   */
  reset(): void {
    if (existsSync(TEMPLATES_FILE)) {
      writeFileSync(TEMPLATES_FILE, JSON.stringify({ templates: {} }, null, 2));
    }
  },
};

/**
 * Parse template definition from string
 * Format: "name:pattern" or "name:pattern:team:priority"
 */
export function parseTemplateDefinition(definition: string): AgentTemplate | null {
  const parts = definition.split(':').map(p => p.trim());
  
  if (parts.length < 2) {
    return null;
  }

  const template: AgentTemplate = {
    name: parts[0],
    pattern: parts[1],
  };

  if (parts[2]) {
    template.teamKey = parts[2].toUpperCase();
  }

  if (parts[3]) {
    const priority = parseInt(parts[3], 10);
    if (priority >= 0 && priority <= 4) {
      template.priority = priority;
    }
  }

  return template;
}
