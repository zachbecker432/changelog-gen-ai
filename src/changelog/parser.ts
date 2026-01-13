import { readFileSync, existsSync } from 'fs';
import type { ParsedChangelog, ChangelogVersion, ChangelogEntry, ChangelogCategory } from '../types.js';

/**
 * Regular expressions for parsing changelog
 */
const VERSION_HEADER_REGEX = /^##\s+\[?([^\]]+)\]?(?:\s*-\s*|\s+)(\d{4}-\d{2}-\d{2})?/;
const CATEGORY_HEADER_REGEX = /^###\s+(.+)$/;
const ENTRY_REGEX = /^[-*]\s+(.+)$/;

/**
 * Valid Keep a Changelog categories
 */
const VALID_CATEGORIES: ChangelogCategory[] = [
  'Added',
  'Changed', 
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
];

/**
 * Parse a changelog file into structured data
 */
export function parseChangelog(content: string): ParsedChangelog {
  const lines = content.split('\n');
  
  let title = 'Changelog';
  let description = '';
  const versions: ChangelogVersion[] = [];
  
  let currentVersion: ChangelogVersion | null = null;
  let currentCategory: ChangelogCategory | null = null;
  let inPreamble = true;
  const preambleLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for main title
    if (line.startsWith('# ') && i < 5) {
      title = line.substring(2).trim();
      inPreamble = true;
      continue;
    }

    // Check for version header
    const versionMatch = line.match(VERSION_HEADER_REGEX);
    if (versionMatch) {
      // Save previous version if exists
      if (currentVersion) {
        versions.push(currentVersion);
      }

      if (inPreamble) {
        description = preambleLines.join('\n').trim();
        inPreamble = false;
      }

      currentVersion = {
        version: versionMatch[1].trim(),
        date: versionMatch[2] ? new Date(versionMatch[2]) : null,
        entries: [],
      };
      currentCategory = null;
      continue;
    }

    // Check for category header (case-insensitive matching)
    const categoryMatch = line.match(CATEGORY_HEADER_REGEX);
    if (categoryMatch && currentVersion) {
      const rawCategoryName = categoryMatch[1].trim();
      // Find matching category case-insensitively
      const matchedCategory = VALID_CATEGORIES.find(
        cat => cat.toLowerCase() === rawCategoryName.toLowerCase()
      );
      if (matchedCategory) {
        currentCategory = matchedCategory;
      }
      continue;
    }

    // Check for entry
    const entryMatch = line.match(ENTRY_REGEX);
    if (entryMatch && currentVersion && currentCategory) {
      const entry: ChangelogEntry = {
        category: currentCategory,
        description: entryMatch[1].trim(),
        commits: [],
      };
      currentVersion.entries.push(entry);
      continue;
    }

    // Collect preamble text
    if (inPreamble && line.trim()) {
      preambleLines.push(line);
    }
  }

  // Don't forget the last version
  if (currentVersion) {
    versions.push(currentVersion);
  }

  return {
    title,
    description,
    versions,
  };
}

/**
 * Load and parse a changelog file
 */
export function loadChangelog(filePath: string): ParsedChangelog | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseChangelog(content);
  } catch {
    return null;
  }
}

/**
 * Get the latest version from a changelog
 */
export function getLatestVersion(changelog: ParsedChangelog): ChangelogVersion | null {
  // Skip "Unreleased" section
  const releasedVersions = changelog.versions.filter(
    v => v.version.toLowerCase() !== 'unreleased'
  );
  
  return releasedVersions[0] || null;
}

/**
 * Get the date of the latest version
 */
export function getLatestVersionDate(changelog: ParsedChangelog): Date | null {
  const latest = getLatestVersion(changelog);
  return latest?.date || null;
}

