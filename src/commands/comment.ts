import { Command } from 'commander';
import chalk from 'chalk';
import { editor, confirm } from '@inquirer/prompts';
import { getAuthenticatedClient } from '../lib/client.js';
import { formatIdentifier, formatDate } from '../utils/format.js';
import {
  isJsonMode,
  outputJson,
  outputJsonError,
  commentToJson,
  ExitCodes,
  type CommentJson,
} from '../utils/json-output.js';

/**
 * Register comment commands
 */
export function registerCommentCommands(program: Command): void {
  const comment = program
    .command('comment')
    .description('Manage issue comments');

  // List comments
  comment
    .command('list <issue>')
    .description('List all comments on an issue')
    .option('--include-resolved', 'Include resolved comments')
    .option('--json', 'Output in JSON format')
    .action(async (issueId: string, options) => {
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

        const comments = await issue.comments({
          first: 50,
          orderBy: { createdAt: 'ascending' } as unknown as undefined,
        });

        // Filter comments based on resolved state
        let filteredComments = comments.nodes;
        if (!options.includeResolved) {
          filteredComments = comments.nodes.filter(c => !c.resolvedAt);
        }

        if (isJsonMode()) {
          const commentsJson: CommentJson[] = await Promise.all(
            filteredComments.map(c => commentToJson(c))
          );
          outputJson({ 
            comments: commentsJson, 
            count: commentsJson.length,
            totalCount: comments.nodes.length,
            resolvedCount: comments.nodes.filter(c => c.resolvedAt).length,
          });
          return;
        }

        console.log(chalk.bold(`\nComments on ${formatIdentifier(issue.identifier)}: ${issue.title}`));
        console.log(chalk.gray('-'.repeat(60)));
        console.log('');

        if (comments.nodes.length === 0) {
          console.log(chalk.gray('No comments on this issue.'));
          return;
        }

        let displayedCount = 0;
        for (const commentNode of comments.nodes) {
          // Skip resolved if not including them
          if (commentNode.resolvedAt && !options.includeResolved) {
            continue;
          }

          const user = await commentNode.user;
          const userName = user?.name || user?.email || 'Unknown';
          const createdAt = formatDate(commentNode.createdAt);
          const resolved = commentNode.resolvedAt ? chalk.green(' [Resolved]') : '';

          console.log(chalk.cyan(`${userName}`) + chalk.gray(` - ${createdAt}`) + resolved);

          // Format comment body
          const body = commentNode.body || '';
          const lines = body.split('\n');
          for (const line of lines) {
            console.log(chalk.white(`  ${line}`));
          }
          console.log('');

          displayedCount++;
        }

        if (displayedCount === 0 && comments.nodes.length > 0) {
          console.log(chalk.gray('All comments are resolved. Use --include-resolved to show them.'));
        }

        const resolvedCount = comments.nodes.filter(c => c.resolvedAt).length;
        if (resolvedCount > 0 && !options.includeResolved) {
          console.log(chalk.gray(`(${resolvedCount} resolved comment${resolvedCount === 1 ? '' : 's'} hidden)`));
        }

      } catch (error) {
        handleError(error);
      }
    });

  // Add comment
  comment
    .command('add <issue> [body]')
    .description('Add a comment to an issue')
    .option('-e, --editor', 'Open editor for comment body')
    .option('--json', 'Output in JSON format')
    .action(async (issueId: string, body: string | undefined, options) => {
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

        let commentBody = body;

        // If no body provided or editor flag, open editor (skip in JSON mode if body provided)
        if (!isJsonMode() && (!commentBody || options.editor)) {
          commentBody = await editor({
            message: 'Write your comment:',
            default: body || '',
            waitForUserInput: false,
          });
        }

        if (!commentBody || !commentBody.trim()) {
          if (isJsonMode()) {
            outputJsonError('EMPTY_BODY', 'Comment body is empty');
            process.exit(ExitCodes.VALIDATION_ERROR);
          }
          console.log(chalk.yellow('Comment body is empty. Cancelled.'));
          return;
        }

        // Create the comment
        const result = await client.createComment({
          issueId: issue.id,
          body: commentBody.trim(),
        });

        const createdComment = await result.comment;

        if (createdComment) {
          if (isJsonMode()) {
            const commentJson = await commentToJson(createdComment);
            outputJson({ comment: commentJson });
            return;
          }
          console.log(chalk.green(`\nComment added to ${formatIdentifier(issue.identifier)}`));
        } else {
          if (isJsonMode()) {
            outputJsonError('CREATE_FAILED', 'Failed to create comment');
            process.exit(ExitCodes.GENERAL_ERROR);
          }
          console.log(chalk.red('Failed to create comment.'));
          process.exit(ExitCodes.GENERAL_ERROR);
        }

      } catch (error) {
        handleError(error);
      }
    });

  // Resolve comment
  comment
    .command('resolve <commentId>')
    .description('Mark a comment as resolved')
    .action(async (commentId: string) => {
      try {
        const client = await getAuthenticatedClient();

        // Find the comment by ID
        const commentNode = await client.comment({ id: commentId });

        if (!commentNode) {
          console.log(chalk.red(`Comment "${commentId}" not found.`));
          process.exit(1);
        }

        if (commentNode.resolvedAt) {
          console.log(chalk.yellow('Comment is already resolved.'));
          return;
        }

        // Resolve the comment using resolveComment mutation
        await client.commentResolve(commentId);

        console.log(chalk.green('Comment marked as resolved.'));

      } catch (error) {
        handleError(error);
      }
    });

  // Unresolve comment
  comment
    .command('unresolve <commentId>')
    .description('Mark a resolved comment as unresolved')
    .action(async (commentId: string) => {
      try {
        const client = await getAuthenticatedClient();

        const commentNode = await client.comment({ id: commentId });

        if (!commentNode) {
          console.log(chalk.red(`Comment "${commentId}" not found.`));
          process.exit(1);
        }

        if (!commentNode.resolvedAt) {
          console.log(chalk.yellow('Comment is not resolved.'));
          return;
        }

        // Unresolve the comment using unresolveComment mutation
        await client.commentUnresolve(commentId);

        console.log(chalk.green('Comment marked as unresolved.'));

      } catch (error) {
        handleError(error);
      }
    });

  // Delete comment
  comment
    .command('delete <commentId>')
    .description('Delete a comment')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (commentId: string, options) => {
      try {
        const client = await getAuthenticatedClient();

        const commentNode = await client.comment({ id: commentId });

        if (!commentNode) {
          console.log(chalk.red(`Comment "${commentId}" not found.`));
          process.exit(1);
        }

        // Confirm deletion
        if (!options.yes) {
          const shouldDelete = await confirm({
            message: 'Are you sure you want to delete this comment?',
            default: false,
          });

          if (!shouldDelete) {
            console.log(chalk.gray('Cancelled.'));
            return;
          }
        }

        await client.deleteComment(commentId);

        console.log(chalk.green('Comment deleted.'));

      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Find an issue by identifier (e.g., "ENG-123") or ID
 */
async function findIssue(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  identifier: string
) {
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
 * Handle errors consistently
 */
function handleError(error: unknown): never {
  if (error instanceof Error) {
    if (error.name === 'ExitPromptError') {
      console.log(chalk.gray('\nCancelled.'));
      process.exit(0);
    }
    console.log(chalk.red(`Error: ${error.message}`));
  } else {
    console.log(chalk.red('An unknown error occurred.'));
  }
  process.exit(1);
}
