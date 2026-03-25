import chalk from 'chalk';
import { IssueRelationType } from '@linear/sdk';
import { getAuthenticatedClient } from '../lib/client.js';
import { findIssueByIdentifier } from '../utils/find-issue.js';
import { formatIdentifier } from '../utils/format.js';
import { isJsonMode, outputJson, outputJsonError, relationToJson, ExitCodes, } from '../utils/json-output.js';
/**
 * Map CLI-friendly relation type names to Linear API enum values
 */
const RELATION_TYPE_MAP = {
    'blocks': IssueRelationType.Blocks,
    'blocked-by': IssueRelationType.Blocks, // reversed: we swap issue/relatedIssue
    'relates-to': IssueRelationType.Related,
    'related': IssueRelationType.Related,
    'duplicate': IssueRelationType.Duplicate,
    'duplicates': IssueRelationType.Duplicate,
    'duplicate-of': IssueRelationType.Duplicate, // reversed
};
const RELATION_TYPE_LABELS = {
    blocks: 'blocks',
    related: 'relates to',
    duplicate: 'is duplicate of',
};
/**
 * Register issue relation commands
 */
export function registerRelationCommands(program) {
    const relation = program
        .command('relation')
        .description('Manage issue relations (blocks, relates-to, duplicate)');
    // ─────────────────────────────────────────────────────────────────
    // ADD RELATION
    // ─────────────────────────────────────────────────────────────────
    relation
        .command('add <issue> <type> <relatedIssue>')
        .description('Create a relation between two issues')
        .addHelpText('after', `
Relation types:
  blocks        Issue blocks the related issue
  blocked-by    Issue is blocked by the related issue
  relates-to    Issues are related
  duplicate     Issue is a duplicate of the related issue

Examples:
  $ linear relation add ENG-1 blocks ENG-2
  $ linear relation add ENG-3 blocked-by ENG-4
  $ linear relation add ENG-5 relates-to ENG-6
  $ linear relation add ENG-7 duplicate ENG-8
`)
        .option('--json', 'Output in JSON format')
        .action(async (issueId, type, relatedId) => {
        try {
            const client = await getAuthenticatedClient();
            // Validate relation type
            const normalizedType = type.toLowerCase();
            const apiType = RELATION_TYPE_MAP[normalizedType];
            if (!apiType) {
                const validTypes = Object.keys(RELATION_TYPE_MAP).join(', ');
                if (isJsonMode()) {
                    outputJsonError('INVALID_TYPE', `Invalid relation type "${type}". Valid types: ${validTypes}`);
                    process.exit(ExitCodes.VALIDATION_ERROR);
                }
                console.log(chalk.red(`Invalid relation type "${type}".`));
                console.log(`Valid types: ${validTypes}`);
                process.exit(ExitCodes.VALIDATION_ERROR);
            }
            // Find both issues
            const [issue, relatedIssue] = await Promise.all([
                findIssueByIdentifier(client, issueId),
                findIssueByIdentifier(client, relatedId),
            ]);
            if (!issue) {
                if (isJsonMode()) {
                    outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
                    process.exit(ExitCodes.NOT_FOUND);
                }
                console.log(chalk.red(`Issue "${issueId}" not found.`));
                process.exit(ExitCodes.NOT_FOUND);
            }
            if (!relatedIssue) {
                if (isJsonMode()) {
                    outputJsonError('NOT_FOUND', `Issue "${relatedId}" not found`);
                    process.exit(ExitCodes.NOT_FOUND);
                }
                console.log(chalk.red(`Issue "${relatedId}" not found.`));
                process.exit(ExitCodes.NOT_FOUND);
            }
            // For "blocked-by" and "duplicate-of", swap the direction
            const isReversed = normalizedType === 'blocked-by' || normalizedType === 'duplicate-of';
            const sourceId = isReversed ? relatedIssue.id : issue.id;
            const targetId = isReversed ? issue.id : relatedIssue.id;
            const result = await client.createIssueRelation({
                issueId: sourceId,
                relatedIssueId: targetId,
                type: apiType,
            });
            const createdRelation = await result.issueRelation;
            if (isJsonMode()) {
                if (createdRelation) {
                    const relJson = await relationToJson(createdRelation);
                    outputJson({ relation: relJson });
                }
                else {
                    outputJson({ success: true });
                }
                return;
            }
            const typeLabel = normalizedType === 'blocked-by' ? 'is blocked by' :
                normalizedType === 'duplicate-of' ? 'is duplicate of' :
                    RELATION_TYPE_LABELS[apiType] || apiType;
            console.log(chalk.green(`${formatIdentifier(issue.identifier)} ${typeLabel} ${formatIdentifier(relatedIssue.identifier)}`));
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('CREATE_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to create relation.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // LIST RELATIONS
    // ─────────────────────────────────────────────────────────────────
    relation
        .command('list <issue>')
        .description('List all relations for an issue')
        .option('--json', 'Output in JSON format')
        .action(async (issueId) => {
        try {
            const client = await getAuthenticatedClient();
            const issue = await findIssueByIdentifier(client, issueId);
            if (!issue) {
                if (isJsonMode()) {
                    outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
                    process.exit(ExitCodes.NOT_FOUND);
                }
                console.log(chalk.red(`Issue "${issueId}" not found.`));
                process.exit(ExitCodes.NOT_FOUND);
            }
            // Get both directions of relations
            const [relations, inverseRelations] = await Promise.all([
                issue.relations(),
                issue.inverseRelations(),
            ]);
            const allRelations = [...relations.nodes, ...inverseRelations.nodes];
            if (isJsonMode()) {
                const relationsJson = await Promise.all(allRelations.map(r => relationToJson(r)));
                outputJson({ relations: relationsJson, count: relationsJson.length });
                return;
            }
            if (allRelations.length === 0) {
                console.log(chalk.yellow(`No relations found for ${formatIdentifier(issue.identifier)}.`));
                return;
            }
            console.log('');
            console.log(chalk.bold(`Relations for ${formatIdentifier(issue.identifier)}: ${issue.title}`));
            console.log(chalk.gray('─'.repeat(60)));
            console.log('');
            for (const rel of relations.nodes) {
                const related = await rel.relatedIssue;
                if (!related)
                    continue;
                const typeLabel = RELATION_TYPE_LABELS[rel.type] || rel.type;
                console.log(`  ${formatIdentifier(issue.identifier)} ${chalk.yellow(typeLabel)} ${formatIdentifier(related.identifier)} ${chalk.gray(related.title)}`);
            }
            for (const rel of inverseRelations.nodes) {
                const source = await rel.issue;
                if (!source)
                    continue;
                const typeLabel = rel.type === 'blocks' ? 'is blocked by' :
                    rel.type === 'duplicate' ? 'is duplicate of' :
                        RELATION_TYPE_LABELS[rel.type] || rel.type;
                console.log(`  ${formatIdentifier(issue.identifier)} ${chalk.yellow(typeLabel)} ${formatIdentifier(source.identifier)} ${chalk.gray(source.title)}`);
            }
            console.log('');
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to fetch relations.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
    // ─────────────────────────────────────────────────────────────────
    // REMOVE RELATION
    // ─────────────────────────────────────────────────────────────────
    relation
        .command('remove <relationId>')
        .description('Remove a relation by its ID')
        .option('--json', 'Output in JSON format')
        .action(async (relationId) => {
        try {
            const client = await getAuthenticatedClient();
            await client.deleteIssueRelation(relationId);
            if (isJsonMode()) {
                outputJson({ deleted: true, id: relationId });
                return;
            }
            console.log(chalk.green('Relation removed.'));
        }
        catch (error) {
            if (isJsonMode()) {
                outputJsonError('DELETE_FAILED', error instanceof Error ? error.message : 'Unknown error');
                process.exit(ExitCodes.GENERAL_ERROR);
            }
            console.log(chalk.red('Failed to remove relation.'));
            if (error instanceof Error)
                console.log(chalk.gray(error.message));
            process.exit(ExitCodes.GENERAL_ERROR);
        }
    });
}
