import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { AICategorizedChanges } from '../types.js';
import { formatVersion, createNewChangelog } from './formatter.js';

/**
 * Insert a new version into an existing changelog content
 */
export function insertVersion(
  existingContent: string,
  version: string,
  date: Date,
  categorizedChanges: AICategorizedChanges,
  repoUrl?: string
): string {
  const lines = existingContent.split('\n');
  const newVersionContent = formatVersion(version, date, categorizedChanges, repoUrl);
  
  // Find where to insert (after Unreleased or after header/preamble)
  let insertIndex = -1;
  let foundUnreleased = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for Unreleased section
    if (line.match(/^##\s+\[?Unreleased\]?/i)) {
      foundUnreleased = true;
      continue;
    }
    
    // If we found Unreleased, look for the next version header
    if (foundUnreleased && line.match(/^##\s+\[?[^\]]+\]?/)) {
      insertIndex = i;
      break;
    }
    
    // No Unreleased section, insert before first version
    if (line.startsWith('## ') && !foundUnreleased) {
      insertIndex = i;
      break;
    }
  }

  // If no insertion point found, append after preamble
  if (insertIndex === -1) {
    // Find end of preamble (look for empty line after content)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        insertIndex = i;
        break;
      }
    }
    
    // If still not found, append at end
    if (insertIndex === -1) {
      insertIndex = lines.length;
    }
  }

  // Insert the new version
  const resultLines = [
    ...lines.slice(0, insertIndex),
    newVersionContent,
    '',
    ...lines.slice(insertIndex),
  ];

  return resultLines.join('\n');
}

/**
 * Update or create the Unreleased section
 */
export function updateUnreleasedSection(
  existingContent: string,
  categorizedChanges: AICategorizedChanges
): string {
  // Find and update the Unreleased section
  // For now, we'll replace it entirely (could be smarter about merging)
  const lines = existingContent.split('\n');
  let unreleasedStart = -1;
  let unreleasedEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/^##\s+\[?Unreleased\]?/i)) {
      unreleasedStart = i;
      continue;
    }
    
    if (unreleasedStart !== -1 && line.match(/^##\s+\[?[^\]]+\]?/)) {
      unreleasedEnd = i;
      break;
    }
  }

  if (unreleasedStart === -1) {
    // No Unreleased section, need to add one
    return existingContent;
  }

  if (unreleasedEnd === -1) {
    unreleasedEnd = lines.length;
  }

  const newUnreleasedContent = formatVersion('Unreleased', null, categorizedChanges);
  
  const resultLines = [
    ...lines.slice(0, unreleasedStart),
    newUnreleasedContent,
    '',
    ...lines.slice(unreleasedEnd),
  ];

  return resultLines.join('\n');
}

/**
 * Write changelog to file
 */
export function writeChangelog(
  filePath: string,
  version: string,
  date: Date,
  categorizedChanges: AICategorizedChanges,
  repoUrl?: string
): void {
  let content: string;

  if (existsSync(filePath)) {
    const existingContent = readFileSync(filePath, 'utf-8');
    content = insertVersion(existingContent, version, date, categorizedChanges, repoUrl);
  } else {
    content = createNewChangelog(version, date, categorizedChanges, repoUrl);
  }

  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Preview changelog output without writing
 */
export function previewChangelog(
  filePath: string,
  version: string,
  date: Date,
  categorizedChanges: AICategorizedChanges,
  repoUrl?: string
): string {
  if (existsSync(filePath)) {
    const existingContent = readFileSync(filePath, 'utf-8');
    return insertVersion(existingContent, version, date, categorizedChanges, repoUrl);
  } else {
    return createNewChangelog(version, date, categorizedChanges, repoUrl);
  }
}
