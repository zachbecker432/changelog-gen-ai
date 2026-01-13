/**
 * Configuration options for the changelog generator
 */
export interface Config {
  /** Output file path for the changelog */
  output: string;
  /** OpenAI-compatible API endpoint */
  openaiUrl: string;
  /** Model to use for summarization */
  model: string;
  /** How to determine "since last update": tags | changelog | manual */
  versionSource: 'tags' | 'changelog' | 'manual';
  /** Include links to commits in the changelog */
  includeCommitLinks: boolean;
  /** Commit patterns to exclude from changelog */
  excludePatterns: string[];
  /** Repository URL for commit links (auto-detected if not provided) */
  repoUrl?: string;
}

/**
 * Parsed commit information
 */
export interface CommitInfo {
  /** Commit SHA hash */
  hash: string;
  /** Short hash (first 7 characters) */
  shortHash: string;
  /** Commit author name */
  author: string;
  /** Commit date */
  date: Date;
  /** Commit message subject (first line) */
  subject: string;
  /** Full commit message body */
  body: string;
  /** Files changed in this commit */
  files: string[];
  /** Diff content for this commit */
  diff: string;
}

/**
 * Keep a Changelog category types
 */
export type ChangelogCategory = 
  | 'Added'
  | 'Changed'
  | 'Deprecated'
  | 'Removed'
  | 'Fixed'
  | 'Security';

/**
 * A single changelog entry
 */
export interface ChangelogEntry {
  /** The category this entry belongs to */
  category: ChangelogCategory;
  /** The description of the change */
  description: string;
  /** Related commit hashes */
  commits: string[];
}

/**
 * A version release in the changelog
 */
export interface ChangelogVersion {
  /** Version number (e.g., "1.0.0") or "Unreleased" */
  version: string;
  /** Release date */
  date: Date | null;
  /** Entries grouped by category */
  entries: ChangelogEntry[];
}

/**
 * Parsed changelog file structure
 */
export interface ParsedChangelog {
  /** Title of the changelog */
  title: string;
  /** Description/preamble text */
  description: string;
  /** All versions in the changelog */
  versions: ChangelogVersion[];
}

/**
 * CLI options passed to the generate command
 */
export interface GenerateOptions {
  /** Starting point (tag, SHA, or "last-changelog") */
  from?: string;
  /** End point (default: HEAD) */
  to: string;
  /** Output file path */
  output: string;
  /** Custom OpenAI-compatible API endpoint */
  openaiUrl?: string;
  /** OpenAI API key */
  apiKey?: string;
  /** Model to use */
  model?: string;
  /** Preview without writing */
  dryRun: boolean;
  /** Version string for the new release */
  version?: string;
  /** Path to config file */
  config?: string;
}

/**
 * Result from AI categorization
 */
export interface AICategorizedChanges {
  /** Changes organized by category */
  categories: Record<ChangelogCategory, string[]>;
}
