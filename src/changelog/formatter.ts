import type { ChangelogCategory, ChangelogEntry, ChangelogVersion, AICategorizedChanges } from '../types.js';

/**
 * Category order according to Keep a Changelog
 */
const CATEGORY_ORDER: ChangelogCategory[] = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
];

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a single changelog entry
 */
export function formatEntry(entry: ChangelogEntry, repoUrl?: string): string {
  let line = `- ${entry.description}`;
  
  // Add commit links if available
  if (entry.commits.length > 0 && repoUrl) {
    const links = entry.commits.map(hash => {
      const shortHash = hash.substring(0, 7);
      return `[${shortHash}](${repoUrl}/commit/${hash})`;
    });
    line += ` (${links.join(', ')})`;
  }
  
  return line;
}

/**
 * Format entries from AI categorization
 */
export function formatAIEntries(
  categorizedChanges: AICategorizedChanges,
  repoUrl?: string
): string {
  const sections: string[] = [];

  for (const category of CATEGORY_ORDER) {
    const entries = categorizedChanges.categories[category];
    
    if (entries && entries.length > 0) {
      sections.push(`### ${category}\n`);
      
      for (const description of entries) {
        const entry: ChangelogEntry = {
          category,
          description,
          commits: [], // AI doesn't map individual entries to commits
        };
        sections.push(formatEntry(entry, repoUrl));
      }
      
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Format a version section
 */
export function formatVersion(
  version: string,
  date: Date | null,
  categorizedChanges: AICategorizedChanges,
  repoUrl?: string
): string {
  const lines: string[] = [];
  
  // Version header
  let header = `## [${version}]`;
  if (date) {
    header += ` - ${formatDate(date)}`;
  }
  lines.push(header);
  lines.push('');
  
  // Add entries
  const entriesContent = formatAIEntries(categorizedChanges, repoUrl);
  if (entriesContent.trim()) {
    lines.push(entriesContent);
  }

  return lines.join('\n');
}

/**
 * Format the "Unreleased" section header
 */
export function formatUnreleasedHeader(): string {
  return '## [Unreleased]\n';
}

/**
 * Create a new changelog from scratch
 */
export function createNewChangelog(
  version: string,
  date: Date,
  categorizedChanges: AICategorizedChanges,
  repoUrl?: string
): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Changelog');
  lines.push('');
  lines.push('All notable changes to this project will be documented in this file.');
  lines.push('');
  lines.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),');
  lines.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).');
  lines.push('');
  
  // Unreleased section (empty placeholder)
  lines.push(formatUnreleasedHeader());
  lines.push('');
  
  // Current version
  lines.push(formatVersion(version, date, categorizedChanges, repoUrl));
  
  return lines.join('\n');
}

/**
 * Generate comparison links for versions
 */
export function generateCompareLinks(
  versions: string[],
  repoUrl: string
): string {
  if (!repoUrl || versions.length < 2) {
    return '';
  }

  const lines: string[] = [];
  
  for (let i = 0; i < versions.length - 1; i++) {
    const current = versions[i];
    const previous = versions[i + 1];
    lines.push(`[${current}]: ${repoUrl}/compare/${previous}...${current}`);
  }
  
  // Last version compared to initial commit or first tag
  const lastVersion = versions[versions.length - 1];
  lines.push(`[${lastVersion}]: ${repoUrl}/releases/tag/${lastVersion}`);
  
  return lines.join('\n');
}
