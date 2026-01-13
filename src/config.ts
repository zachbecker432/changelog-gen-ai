import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import type { Config } from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  output: 'CHANGELOG.md',
  openaiUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  versionSource: 'tags',
  includeCommitLinks: true,
  excludePatterns: ['chore(deps):', 'Merge branch', 'Merge pull request'],
};

/**
 * Config file names to search for (in order of priority)
 */
const CONFIG_FILE_NAMES = [
  '.changelogrc.yaml',
  '.changelogrc.yml',
  '.changelogrc.json',
  'changelog.config.yaml',
  'changelog.config.yml',
];

/**
 * Find the config file in the current directory or parent directories
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = resolve(startDir);
  const root = resolve('/');

  while (currentDir !== root) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = resolve(currentDir, fileName);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}

/**
 * Load configuration from a file
 */
export function loadConfigFile(filePath: string): Partial<Config> {
  const content = readFileSync(filePath, 'utf-8');
  
  if (filePath.endsWith('.json')) {
    return JSON.parse(content) as Partial<Config>;
  }
  
  return parseYaml(content) as Partial<Config>;
}

/**
 * Load and merge configuration from file and defaults
 */
export function loadConfig(configPath?: string): Config {
  let fileConfig: Partial<Config> = {};

  const configFile = configPath || findConfigFile();
  
  if (configFile && existsSync(configFile)) {
    try {
      fileConfig = loadConfigFile(configFile);
    } catch (error) {
      console.warn(`Warning: Failed to parse config file ${configFile}:`, error);
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
  };
}

/**
 * Get OpenAI API key from environment or config
 */
export function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}
