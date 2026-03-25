import { Command } from 'commander';
import { editor } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../lib/client.js';
import { findProject } from '../utils/find-issue.js';
import { formatDate, truncate } from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  documentToJson,
  documentSearchResultToJson,
  ExitCodes,
  type DocumentJson,
} from '../utils/json-output.js';

/**
 * Register document management commands
 */
export function registerDocCommands(program: Command): void {
  const doc = program
    .command('doc')
    .description('Manage Linear documents');

  // ─────────────────────────────────────────────────────────────────
  // LIST COMMAND
  // ─────────────────────────────────────────────────────────────────
  doc
    .command('list')
    .description('List documents')
    .option('-p, --project <name>', 'Filter by project name')
    .option('-l, --limit <number>', 'Maximum number of documents', '25')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const client = await getAuthenticatedClient();

        const filter: Record<string, unknown> = {};

        if (options.project) {
          const project = await findProject(client, options.project);
          if (project) {
            filter.project = { id: { eq: project.id } };
          } else {
            if (isJsonMode()) {
              outputJsonError('NOT_FOUND', `Project "${options.project}" not found`);
              process.exit(ExitCodes.NOT_FOUND);
            }
            console.log(chalk.red(`Project "${options.project}" not found.`));
            process.exit(ExitCodes.NOT_FOUND);
          }
        }

        const docs = await client.documents({
          first: parseInt(options.limit, 10),
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        });

        if (isJsonMode()) {
          const docsJson: DocumentJson[] = await Promise.all(
            docs.nodes.map(d => documentToJson(d))
          );
          outputJson({ documents: docsJson, count: docsJson.length });
          return;
        }

        if (docs.nodes.length === 0) {
          console.log(chalk.yellow('No documents found.'));
          return;
        }

        console.log('');
        console.log(chalk.bold('Documents'));
        console.log(chalk.gray('─'.repeat(70)));

        for (const d of docs.nodes) {
          const project = await d.project;
          const projectStr = project ? chalk.gray(` [${project.name}]`) : '';
          const date = formatDate(d.updatedAt);

          console.log(`  ${chalk.cyan(d.title)}${projectStr}`);
          console.log(`  ${chalk.gray(`Updated ${date} · ${d.slugId}`)}`);

          if (d.content) {
            const preview = truncate(d.content.replace(/\n/g, ' ').trim(), 80);
            console.log(`  ${chalk.gray(preview)}`);
          }
          console.log('');
        }

        console.log(chalk.gray(`Showing ${docs.nodes.length} document${docs.nodes.length === 1 ? '' : 's'}`));
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch documents.'));
        if (error instanceof Error) console.log(chalk.gray(error.message));
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // VIEW COMMAND
  // ─────────────────────────────────────────────────────────────────
  doc
    .command('view <titleOrId>')
    .description('View a document by title or ID')
    .option('--json', 'Output in JSON format')
    .action(async (titleOrId: string) => {
      try {
        const client = await getAuthenticatedClient();

        // Try to find by title first
        const docs = await client.documents({
          filter: { title: { containsIgnoreCase: titleOrId } },
          first: 5,
        });

        let doc = docs.nodes.find(
          d => d.title.toLowerCase() === titleOrId.toLowerCase()
        ) || docs.nodes[0];

        // If no match by title, try by ID
        if (!doc) {
          try {
            doc = await client.document(titleOrId);
          } catch {
            // Not found
          }
        }

        if (!doc) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Document "${titleOrId}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Document "${titleOrId}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }

        if (isJsonMode()) {
          const docJson = await documentToJson(doc);
          outputJson({ document: docJson });
          return;
        }

        const project = await doc.project;
        const creator = await doc.creator;

        console.log('');
        console.log(chalk.bold(doc.title));
        console.log(chalk.gray('─'.repeat(60)));

        if (project) {
          console.log(chalk.gray('Project:   ') + project.name);
        }
        if (creator) {
          console.log(chalk.gray('Author:    ') + (creator.name || creator.email));
        }
        console.log(chalk.gray('Updated:   ') + formatDate(doc.updatedAt));
        console.log(chalk.gray('URL:       ') + chalk.underline(doc.url));

        if (doc.content) {
          console.log('');
          console.log(doc.content);
        }
        console.log('');
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch document.'));
        if (error instanceof Error) console.log(chalk.gray(error.message));
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // CREATE COMMAND
  // ─────────────────────────────────────────────────────────────────
  doc
    .command('create <title>')
    .description('Create a new document')
    .option('-p, --project <name>', 'Associate with a project')
    .option('-b, --body <content>', 'Document content (markdown)')
    .option('-e, --editor', 'Open editor for content')
    .option('--json', 'Output in JSON format')
    .action(async (title: string, options) => {
      try {
        const client = await getAuthenticatedClient();

        // Resolve project if specified
        let projectId: string | undefined;
        if (options.project) {
          const project = await findProject(client, options.project);
          if (project) {
            projectId = project.id;
          } else {
            if (isJsonMode()) {
              outputJsonError('NOT_FOUND', `Project "${options.project}" not found`);
              process.exit(ExitCodes.NOT_FOUND);
            }
            console.log(chalk.yellow(`Project "${options.project}" not found, creating without project.`));
          }
        }

        // Get content
        let content = options.body;
        if (!content && options.editor && !isJsonMode()) {
          content = await editor({
            message: 'Write document content (save and close to continue):',
          });
        }

        const payload = await client.createDocument({
          title: title.trim(),
          content: content?.trim() || '',
          projectId,
        });

        const createdDoc = await payload.document;

        if (createdDoc) {
          if (isJsonMode()) {
            const docJson = await documentToJson(createdDoc);
            outputJson({ document: docJson });
            return;
          }

          console.log(chalk.green('Document created!'));
          console.log(`  ${chalk.cyan(createdDoc.title)}`);
          console.log(`  ${chalk.gray(createdDoc.url)}`);
        } else {
          if (isJsonMode()) {
            outputJsonError('CREATE_FAILED', 'Failed to create document');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Failed to create document.'));
          process.exit(ExitCodes.GENERAL_ERROR);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        if (isJsonMode()) {
          outputJsonError('CREATE_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to create document.'));
        if (error instanceof Error) console.log(chalk.gray(error.message));
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // SEARCH COMMAND
  // ─────────────────────────────────────────────────────────────────
  doc
    .command('search <query>')
    .description('Search documents by title or content')
    .option('-l, --limit <number>', 'Maximum results', '10')
    .option('--json', 'Output in JSON format')
    .action(async (query: string, options) => {
      try {
        const client = await getAuthenticatedClient();

        const docs = await client.searchDocuments(query, {
          first: parseInt(options.limit, 10),
        });

        if (isJsonMode()) {
          const docsJson: DocumentJson[] = await Promise.all(
            docs.nodes.map(d => documentSearchResultToJson(d))
          );
          outputJson({ documents: docsJson, count: docsJson.length, query });
          return;
        }

        if (docs.nodes.length === 0) {
          console.log(chalk.yellow(`No documents found matching "${query}".`));
          return;
        }

        console.log('');
        console.log(chalk.green(`Found ${docs.nodes.length} document${docs.nodes.length === 1 ? '' : 's'}:`));
        console.log('');

        for (const d of docs.nodes) {
          const project = await d.project;
          const projectStr = project ? chalk.gray(` [${project.name}]`) : '';
          console.log(`  ${chalk.cyan(d.title)}${projectStr}`);

          if (d.content) {
            const preview = truncate(d.content.replace(/\n/g, ' ').trim(), 80);
            console.log(`  ${chalk.gray(preview)}`);
          }
          console.log('');
        }
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('SEARCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to search documents.'));
        if (error instanceof Error) console.log(chalk.gray(error.message));
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });
}
