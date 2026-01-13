import OpenAI from 'openai';
import type { CommitInfo, ChangelogCategory, AICategorizedChanges } from '../types.js';

/**
 * System prompt for the AI to categorize changes
 */
const SYSTEM_PROMPT = `You are a changelog writer assistant. Your task is to analyze git commits and their diffs, then categorize and summarize the changes according to the Keep a Changelog format.

Categories you MUST use:
- Added: New features or capabilities
- Changed: Changes to existing functionality
- Deprecated: Features that will be removed in future versions
- Removed: Features that have been removed
- Fixed: Bug fixes
- Security: Security-related changes or vulnerability fixes

Guidelines:
1. Write clear, concise descriptions that explain WHAT changed and WHY it matters to users
2. Focus on user-facing changes; internal refactoring should be summarized briefly
3. Group related commits into single entries when appropriate
4. Use present tense (e.g., "Add user authentication" not "Added")
5. Start each entry with a verb
6. Do not include commit hashes or technical implementation details unless relevant
7. If a commit doesn't fit any category or is too minor (e.g., typo fixes, formatting), you may omit it

Respond with valid JSON only, using this exact format:
{
  "categories": {
    "Added": ["description 1", "description 2"],
    "Changed": ["description"],
    "Deprecated": [],
    "Removed": [],
    "Fixed": ["description"],
    "Security": []
  }
}

Empty arrays are fine for categories with no changes.`;

/**
 * Build the user prompt with commit information
 */
function buildUserPrompt(commits: CommitInfo[]): string {
  const commitDescriptions = commits.map(commit => {
    let description = `## Commit: ${commit.shortHash}\n`;
    description += `Author: ${commit.author}\n`;
    description += `Date: ${commit.date.toISOString()}\n`;
    description += `Message: ${commit.subject}\n`;
    
    if (commit.body) {
      description += `Body: ${commit.body}\n`;
    }
    
    description += `Files changed: ${commit.files.join(', ')}\n`;
    
    if (commit.diff) {
      description += `\nDiff:\n\`\`\`\n${commit.diff}\n\`\`\`\n`;
    }
    
    return description;
  }).join('\n---\n');

  return `Please analyze the following ${commits.length} commit(s) and categorize the changes:\n\n${commitDescriptions}`;
}

/**
 * OpenAI service for generating changelog entries
 */
export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1', model: string = 'gpt-4o-mini') {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
    this.model = model;
  }

  /**
   * Categorize commits using AI
   */
  async categorizeCommits(commits: CommitInfo[]): Promise<AICategorizedChanges> {
    if (commits.length === 0) {
      return {
        categories: {
          Added: [],
          Changed: [],
          Deprecated: [],
          Removed: [],
          Fixed: [],
          Security: [],
        },
      };
    }

    // Batch commits if there are too many (to stay within token limits)
    const batchSize = 10;
    const allCategories: AICategorizedChanges['categories'] = {
      Added: [],
      Changed: [],
      Deprecated: [],
      Removed: [],
      Fixed: [],
      Security: [],
    };

    for (let i = 0; i < commits.length; i += batchSize) {
      const batch = commits.slice(i, i + batchSize);
      const result = await this.processBatch(batch);
      
      // Merge results
      for (const category of Object.keys(allCategories) as ChangelogCategory[]) {
        allCategories[category].push(...(result.categories[category] || []));
      }
    }

    return { categories: allCategories };
  }

  /**
   * Process a batch of commits with retry logic
   */
  private async processBatch(commits: CommitInfo[], retries: number = 3): Promise<AICategorizedChanges> {
    const userPrompt = buildUserPrompt(commits);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        
        if (!content) {
          throw new Error('Empty response from AI');
        }

        const parsed = JSON.parse(content) as AICategorizedChanges;
        
        // Validate the response structure
        if (!parsed.categories) {
          throw new Error('Invalid response structure: missing categories');
        }

        // Ensure all categories exist
        const categories: ChangelogCategory[] = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
        for (const cat of categories) {
          if (!Array.isArray(parsed.categories[cat])) {
            parsed.categories[cat] = [];
          }
        }

        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if it's a rate limit error (429) or transient error (5xx)
        const isRetryable = 
          (error instanceof Error && error.message.includes('429')) ||
          (error instanceof Error && error.message.includes('5')) ||
          (error instanceof Error && error.message.includes('timeout'));
        
        if (isRetryable && attempt < retries) {
          // Exponential backoff: 1s, 2s, 4s...
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        if (error instanceof SyntaxError) {
          throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
        }
        throw error;
      }
    }

    throw lastError || new Error('Failed after retries');
  }

}
