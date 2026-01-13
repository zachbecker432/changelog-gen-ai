import type { CommitInfo } from '../types.js';

/**
 * Parse a raw git log entry into a CommitInfo object
 */
export function parseCommitLog(
  hash: string,
  author: string,
  date: string,
  message: string,
  files: string[],
  diff: string
): CommitInfo {
  const lines = message.split('\n');
  const subject = lines[0] || '';
  const body = lines.slice(1).join('\n').trim();

  return {
    hash,
    shortHash: hash.substring(0, 7),
    author,
    date: new Date(date),
    subject,
    body,
    files,
    diff,
  };
}

/**
 * Check if a commit message matches any exclude pattern
 */
export function shouldExcludeCommit(
  commit: CommitInfo,
  excludePatterns: string[]
): boolean {
  const fullMessage = `${commit.subject}\n${commit.body}`;
  
  return excludePatterns.some(pattern => {
    // Support simple glob-like patterns with *
    if (pattern.includes('*')) {
      // Convert glob pattern to regex that matches anywhere in the message
      const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const regex = new RegExp(regexPattern, 'i');
      return regex.test(fullMessage);
    }
    return fullMessage.toLowerCase().includes(pattern.toLowerCase());
  });
}

/**
 * Truncate diff content to stay within token limits
 * Keeps the most important parts (file headers and key changes)
 */
export function truncateDiff(diff: string, maxLength: number = 4000): string {
  if (diff.length <= maxLength) {
    return diff;
  }

  const lines = diff.split('\n');
  const result: string[] = [];
  let currentLength = 0;
  let inHunk = false;
  let hunkLines = 0;
  const maxHunkLines = 20;

  for (const line of lines) {
    // Always include file headers
    if (line.startsWith('diff --git') || 
        line.startsWith('---') || 
        line.startsWith('+++') ||
        line.startsWith('@@')) {
      if (currentLength + line.length + 1 > maxLength - 100) {
        result.push('... (diff truncated for length)');
        break;
      }
      result.push(line);
      currentLength += line.length + 1;
      inHunk = line.startsWith('@@');
      hunkLines = 0;
      continue;
    }

    // Limit lines within each hunk
    if (inHunk) {
      hunkLines++;
      if (hunkLines <= maxHunkLines) {
        if (currentLength + line.length + 1 > maxLength - 100) {
          result.push('... (diff truncated for length)');
          break;
        }
        result.push(line);
        currentLength += line.length + 1;
      } else if (hunkLines === maxHunkLines + 1) {
        result.push('... (hunk truncated)');
        currentLength += 20;
      }
    }
  }

  return result.join('\n');
}
