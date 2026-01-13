import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { stringify as yamlStringify } from 'yaml';

import { loadConfig, getApiKey, DEFAULT_CONFIG } from './config.js';
import { GitAnalyzer } from './git/analyzer.js';
import { OpenAIService } from './ai/openai.js';
import { loadChangelog, getLatestVersionDate } from './changelog/parser.js';
import { writeChangelog, previewChangelog } from './changelog/writer.js';
import type { GenerateOptions } from './types.js';

/**
 * Create the CLI program
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name('changelog-gen')
    .description('AI-powered changelog generator for GitHub and GitLab repositories')
    .version('1.0.0');

  // Generate command
  program
    .command('generate')
    .description('Generate changelog entries from git commits')
    .option('-f, --from <ref>', 'Starting point (tag, SHA, or "latest-tag")')
    .option('-t, --to <ref>', 'End point', 'HEAD')
    .option('-o, --output <file>', 'Output file path')
    .option('-u, --openai-url <url>', 'OpenAI-compatible API endpoint')
    .option('-k, --api-key <key>', 'OpenAI API key (or use OPENAI_API_KEY env)')
    .option('-m, --model <model>', 'Model to use for summarization')
    .option('-v, --version <version>', 'Version string for the new release')
    .option('-c, --config <file>', 'Path to config file')
    .option('-d, --dry-run', 'Preview without writing', false)
    .action(async (options: GenerateOptions) => {
      await runGenerate(options);
    });

  // Init command
  program
    .command('init')
    .description('Create a default configuration file')
    .option('-f, --force', 'Overwrite existing config file', false)
    .action(async (options: { force: boolean }) => {
      await runInit(options);
    });

  return program;
}

/**
 * Run the generate command
 */
async function runGenerate(options: GenerateOptions): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig(options.config);
    
    // Override config with CLI options
    const output = options.output || config.output;
    const openaiUrl = options.openaiUrl || config.openaiUrl;
    const model = options.model || config.model;
    const apiKey = options.apiKey || getApiKey();

    if (!apiKey) {
      console.error(chalk.red('Error: OpenAI API key is required.'));
      console.error(chalk.yellow('Set OPENAI_API_KEY environment variable or use --api-key option.'));
      process.exit(1);
    }

    // Initialize git analyzer
    const git = new GitAnalyzer();
    
    if (!await git.isGitRepo()) {
      console.error(chalk.red('Error: Not a git repository.'));
      process.exit(1);
    }

    console.log(chalk.blue('Analyzing git history...'));

    // Determine the starting reference
    let fromRef: string | undefined = options.from;
    
    if (!fromRef) {
      if (config.versionSource === 'tags') {
        fromRef = await git.getLatestTag() ?? undefined;
        if (fromRef) {
          console.log(chalk.gray(`Using latest tag: ${fromRef}`));
        }
      } else if (config.versionSource === 'changelog') {
        const changelog = loadChangelog(resolve(process.cwd(), output));
        if (changelog) {
          const lastDate = getLatestVersionDate(changelog);
          if (lastDate) {
            console.log(chalk.gray(`Last changelog entry: ${lastDate.toISOString()}`));
            // For date-based, we'd need to find commits after this date
            // For simplicity, we'll still use tags as fallback
            fromRef = await git.getLatestTag() ?? undefined;
          }
        }
      }
    } else if (fromRef === 'latest-tag') {
      fromRef = await git.getLatestTag() ?? undefined;
      if (fromRef) {
        console.log(chalk.gray(`Using latest tag: ${fromRef}`));
      }
    }

    // Get commits
    const commits = await git.getCommitsBetween(
      fromRef || '',
      options.to,
      config.excludePatterns
    );

    if (commits.length === 0) {
      console.log(chalk.yellow('No commits found in the specified range.'));
      process.exit(0);
    }

    console.log(chalk.blue(`Found ${commits.length} commit(s) to analyze.`));

    // Get repository URL for commit links
    let repoUrl = config.repoUrl;
    if (!repoUrl && config.includeCommitLinks) {
      repoUrl = await git.getRepoUrl() || undefined;
    }

    // Initialize OpenAI service
    console.log(chalk.blue('Analyzing changes with AI...'));
    const ai = new OpenAIService(apiKey, openaiUrl, model);
    
    // Categorize commits
    const categorizedChanges = await ai.categorizeCommits(commits);

    // Check if we have any changes
    const totalEntries = Object.values(categorizedChanges.categories)
      .reduce((sum, entries) => sum + entries.length, 0);
    
    if (totalEntries === 0) {
      console.log(chalk.yellow('No significant changes detected.'));
      process.exit(0);
    }

    // Determine version
    let version = options.version;
    if (!version) {
      const latestTag = await git.getLatestTag();
      if (latestTag) {
        // Suggest next patch version
        const match = latestTag.match(/^v?(\d+)\.(\d+)\.(\d+)/);
        if (match) {
          const [, major, minor, patch] = match;
          version = `${major}.${minor}.${parseInt(patch) + 1}`;
        } else {
          version = 'Unreleased';
        }
      } else {
        version = '1.0.0';
      }
      console.log(chalk.gray(`Using version: ${version}`));
    }

    const releaseDate = new Date();
    const outputPath = resolve(process.cwd(), output);

    if (options.dryRun) {
      console.log(chalk.blue('\n--- DRY RUN: Preview of changelog ---\n'));
      const preview = previewChangelog(
        outputPath,
        version,
        releaseDate,
        categorizedChanges,
        repoUrl
      );
      console.log(preview);
      console.log(chalk.blue('\n--- End of preview ---'));
    } else {
      writeChangelog(
        outputPath,
        version,
        releaseDate,
        categorizedChanges,
        repoUrl
      );
      console.log(chalk.green(`Changelog written to ${output}`));
    }

    // Print summary
    console.log(chalk.blue('\nChanges summary:'));
    for (const [category, entries] of Object.entries(categorizedChanges.categories)) {
      if (entries.length > 0) {
        console.log(chalk.gray(`  ${category}: ${entries.length} entries`));
      }
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Run the init command
 */
async function runInit(options: { force: boolean }): Promise<void> {
  const configPath = resolve(process.cwd(), '.changelogrc.yaml');
  
  if (existsSync(configPath) && !options.force) {
    console.error(chalk.yellow('Config file already exists. Use --force to overwrite.'));
    process.exit(1);
  }

  const configContent = yamlStringify(DEFAULT_CONFIG, {
    lineWidth: 0,
  });

  const yamlContent = `# Changelog Generator Configuration
# See https://www.npmjs.com/package/changelog-gen for documentation

${configContent}`;

  writeFileSync(configPath, yamlContent, 'utf-8');
  console.log(chalk.green(`Created ${configPath}`));
}
