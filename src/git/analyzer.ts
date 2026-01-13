import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import * as semver from 'semver';
import type { CommitInfo } from '../types.js';
import { parseCommitLog, shouldExcludeCommit, truncateDiff } from './commits.js';

/**
 * Git repository analyzer for extracting commit information
 */
export class GitAnalyzer {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  /**
   * Check if the current directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the remote repository URL
   */
  async getRepoUrl(): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      if (!origin?.refs?.fetch) return null;

      let url = origin.refs.fetch;
      
      // Convert SSH URL to HTTPS
      if (url.startsWith('git@')) {
        url = url
          .replace('git@', 'https://')
          .replace(':', '/');
      }
      
      // Remove .git suffix
      url = url.replace(/\.git$/, '');
      
      return url;
    } catch {
      return null;
    }
  }

  /**
   * Get all semver tags sorted by version (descending)
   */
  async getSemverTags(): Promise<string[]> {
    try {
      const result = await this.git.tags();
      const tags = result.all
        .filter(tag => semver.valid(semver.clean(tag)))
        .sort((a, b) => {
          const cleanA = semver.clean(a) || '0.0.0';
          const cleanB = semver.clean(b) || '0.0.0';
          return semver.rcompare(cleanA, cleanB);
        });
      return tags;
    } catch {
      return [];
    }
  }

  /**
   * Get the latest semver tag
   */
  async getLatestTag(): Promise<string | null> {
    const tags = await this.getSemverTags();
    return tags[0] || null;
  }

  /**
   * Get the commit SHA for a given reference (tag, branch, etc.)
   */
  async getCommitSha(ref: string): Promise<string | null> {
    try {
      const result = await this.git.revparse([ref]);
      return result.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get commits between two references
   */
  async getCommitsBetween(
    from: string,
    to: string = 'HEAD',
    excludePatterns: string[] = []
  ): Promise<CommitInfo[]> {
    try {
      // Get commit logs
      const log: LogResult = await this.git.log({
        from: from || undefined,
        to,
        '--name-only': null,
      });

      const commits: CommitInfo[] = [];

      for (const entry of log.all) {
        // Get the diff for this commit
        let diff = '';
        try {
          diff = await this.git.diff([`${entry.hash}^`, entry.hash]);
        } catch {
          // First commit won't have a parent, use empty tree comparison
          try {
            // 4b825dc642cb6eb9a060e54bf8d69288fbee4904 is the SHA of the empty tree in git
            diff = await this.git.diff(['4b825dc642cb6eb9a060e54bf8d69288fbee4904', entry.hash]);
          } catch {
            diff = '';
          }
        }

        // Get files changed
        const showResult = await this.git.show([
          entry.hash,
          '--name-only',
          '--format=',
        ]);
        const files = showResult
          .split('\n')
          .map(f => f.trim())
          .filter(f => f.length > 0);

        const commitInfo = parseCommitLog(
          entry.hash,
          entry.author_name,
          entry.date,
          `${entry.message}${entry.body ? '\n' + entry.body : ''}`,
          files,
          truncateDiff(diff)
        );

        // Check if this commit should be excluded
        if (!shouldExcludeCommit(commitInfo, excludePatterns)) {
          commits.push(commitInfo);
        }
      }

      return commits;
    } catch (error) {
      throw new Error(`Failed to get commits: ${error}`);
    }
  }

  /**
   * Determine the starting point based on version source
   */
  async determineFromRef(
    versionSource: 'tags' | 'changelog' | 'manual',
    explicitFrom?: string
  ): Promise<string | null> {
    if (explicitFrom) {
      // Check if it's "latest-tag" keyword
      if (explicitFrom === 'latest-tag') {
        return await this.getLatestTag();
      }
      return explicitFrom;
    }

    switch (versionSource) {
      case 'tags':
        return await this.getLatestTag();
      case 'changelog':
        // This will be handled by the changelog parser
        return null;
      case 'manual':
        return null;
      default:
        return null;
    }
  }
}
