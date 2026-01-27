import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import type { LinearClient, Issue } from '@linear/sdk';
import { getAuthenticatedClient } from '../lib/client.js';
import { formatIdentifier, formatDate } from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  attachmentToJson,
  ExitCodes,
  type AttachmentJson,
} from '../utils/json-output.js';

/**
 * Find an issue by identifier (e.g., "ENG-123") or ID
 */
async function findIssue(
  client: LinearClient,
  identifier: string
): Promise<Issue | null> {
  const normalized = identifier.toUpperCase();
  const match = normalized.match(/^([A-Z]+)-(\d+)$/);

  if (match) {
    const [, teamKey, numberStr] = match;
    const issueNumber = parseInt(numberStr, 10);

    const issues = await client.issues({
      filter: {
        team: { key: { eq: teamKey } },
        number: { eq: issueNumber },
      },
      first: 1,
    });

    return issues.nodes[0] || null;
  }

  // Try as raw ID
  try {
    return await client.issue(identifier);
  } catch {
    return null;
  }
}

/**
 * Register attachment management commands
 */
export function registerAttachmentCommands(program: Command): void {
  const attachment = program
    .command('attachment')
    .description('Manage issue attachments');

  // ─────────────────────────────────────────────────────────────────
  // LIST COMMAND
  // ─────────────────────────────────────────────────────────────────
  attachment
    .command('list <issue>')
    .description('List all attachments on an issue')
    .option('--json', 'Output in JSON format')
    .action(async (issueId: string) => {
      try {
        const client = await getAuthenticatedClient();
        const issue = await findIssue(client, issueId);

        if (!issue) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Issue "${issueId}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }

        const attachments = await issue.attachments();

        if (isJsonMode()) {
          const attachmentsJson: AttachmentJson[] = attachments.nodes.map(a => attachmentToJson(a));
          outputJson({ 
            attachments: attachmentsJson, 
            count: attachmentsJson.length,
            issue: {
              id: issue.id,
              identifier: issue.identifier,
            },
          });
          return;
        }

        console.log(chalk.bold(`\nAttachments on ${formatIdentifier(issue.identifier)}: ${issue.title}`));
        console.log(chalk.gray('-'.repeat(60)));
        console.log('');

        if (attachments.nodes.length === 0) {
          console.log(chalk.gray('No attachments on this issue.'));
          return;
        }

        for (const att of attachments.nodes) {
          console.log(chalk.cyan(att.title));
          if (att.subtitle) {
            console.log(chalk.gray(`  ${att.subtitle}`));
          }
          console.log(chalk.gray(`  URL: `) + chalk.underline(att.url));
          console.log(chalk.gray(`  Added: ${formatDate(att.createdAt)}`));
          console.log(chalk.gray(`  ID: ${att.id}`));
          console.log('');
        }

        console.log(chalk.gray(`Total: ${attachments.nodes.length} attachment${attachments.nodes.length === 1 ? '' : 's'}`));
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('FETCH_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to fetch attachments.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // ADD COMMAND (URL)
  // ─────────────────────────────────────────────────────────────────
  attachment
    .command('add <issue> <url>')
    .description('Add a URL attachment to an issue')
    .option('-t, --title <title>', 'Attachment title (defaults to URL)')
    .option('-s, --subtitle <subtitle>', 'Attachment subtitle/description')
    .option('--json', 'Output in JSON format')
    .action(async (issueId: string, url: string, options) => {
      try {
        const client = await getAuthenticatedClient();
        const issue = await findIssue(client, issueId);

        if (!issue) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Issue "${issueId}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Issue "${issueId}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }

        // Validate URL
        try {
          new URL(url);
        } catch {
          if (isJsonMode()) {
            outputJsonError('INVALID_URL', `Invalid URL: ${url}`);
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
          console.log(chalk.red(`Invalid URL: ${url}`));
          process.exit(ExitCodes.VALIDATION_ERROR);
        }

        const title = options.title || url;

        if (!isJsonMode()) {
          console.log(chalk.gray('Adding attachment...'));
        }

        // Use attachmentLinkURL to add URL attachment
        const result = await client.attachmentLinkURL(issue.id, url, {
          title,
        });

        const createdAttachment = await result.attachment;

        if (createdAttachment) {
          if (isJsonMode()) {
            const attachmentJson = attachmentToJson(createdAttachment);
            outputJson({ attachment: attachmentJson });
            return;
          }
          console.log(chalk.green(`\nAttachment added to ${formatIdentifier(issue.identifier)}`));
          console.log(chalk.cyan(createdAttachment.title));
          console.log(chalk.gray(`  URL: `) + chalk.underline(createdAttachment.url));
        } else {
          if (isJsonMode()) {
            outputJsonError('CREATE_FAILED', 'Failed to create attachment');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Failed to create attachment.'));
          process.exit(ExitCodes.GENERAL_ERROR);
        }
      } catch (error) {
        if (isJsonMode()) {
          outputJsonError('ADD_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to add attachment.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });

  // ─────────────────────────────────────────────────────────────────
  // REMOVE COMMAND
  // ─────────────────────────────────────────────────────────────────
  attachment
    .command('remove <attachmentId>')
    .description('Remove an attachment')
    .option('-y, --yes', 'Skip confirmation')
    .option('--json', 'Output in JSON format')
    .action(async (attachmentId: string, options) => {
      try {
        const client = await getAuthenticatedClient();

        // Fetch the attachment to verify it exists
        const att = await client.attachment(attachmentId);

        if (!att) {
          if (isJsonMode()) {
            outputJsonError('NOT_FOUND', `Attachment "${attachmentId}" not found`);
            process.exit(ExitCodes.NOT_FOUND);
          }
          console.log(chalk.red(`Attachment "${attachmentId}" not found.`));
          process.exit(ExitCodes.NOT_FOUND);
        }

        // Confirm deletion (skip in JSON mode or with --yes)
        if (!isJsonMode() && !options.yes) {
          console.log(chalk.cyan(att.title));
          console.log(chalk.gray(`  URL: ${att.url}`));
          console.log('');
          
          const shouldDelete = await confirm({
            message: 'Are you sure you want to remove this attachment?',
            default: false,
          });

          if (!shouldDelete) {
            console.log(chalk.gray('Cancelled.'));
            return;
          }
        }

        // Delete the attachment using the attachment object's delete method
        await att.delete();

        if (isJsonMode()) {
          outputJson({ success: true, deletedId: attachmentId });
          return;
        }

        console.log(chalk.green('Attachment removed.'));
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          console.log(chalk.gray('\nCancelled.'));
          return;
        }
        if (isJsonMode()) {
          outputJsonError('REMOVE_FAILED', error instanceof Error ? error.message : 'Unknown error');
          process.exit(ExitCodes.GENERAL_ERROR);
        }
        console.log(chalk.red('Failed to remove attachment.'));
        if (error instanceof Error) {
          console.log(chalk.gray(error.message));
        }
        process.exit(ExitCodes.GENERAL_ERROR);
      }
    });
}
