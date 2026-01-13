# changelog-gen

AI-powered changelog generator for GitHub and GitLab repositories. Analyzes git commits and uses OpenAI to generate well-formatted changelogs following the [Keep a Changelog](https://keepachangelog.com) specification.

## Features

- Analyzes git commits and diffs to understand changes
- Uses AI to categorize and summarize changes (Added, Changed, Fixed, etc.)
- Supports multiple version tracking methods (tags, changelog parsing, manual)
- Works with any OpenAI-compatible API (OpenAI, Azure, local models)
- Easy integration with GitHub Actions and GitLab CI
- Configurable via YAML config file

## Installation

```bash
# Install globally
npm install -g changelog-gen

# Or use directly with npx
npx changelog-gen generate
```

## Quick Start

1. Set your OpenAI API key:

```bash
export OPENAI_API_KEY="your-api-key"
```

2. Generate a changelog:

```bash
# Generate changelog from the latest tag to HEAD
changelog-gen generate --from latest-tag

# Preview without writing (dry run)
changelog-gen generate --from latest-tag --dry-run

# Specify a version
changelog-gen generate --from v1.0.0 --version 1.1.0
```

## Configuration

Create a `.changelogrc.yaml` file in your project root:

```yaml
# Output file path
output: CHANGELOG.md

# OpenAI-compatible API endpoint
openaiUrl: https://api.openai.com/v1

# Model to use
model: gpt-4o-mini

# Version detection method: tags | changelog | manual
versionSource: tags

# Include commit links
includeCommitLinks: true

# Patterns to exclude
excludePatterns:
  - "chore(deps):"
  - "Merge branch"
```

Generate a default config file:

```bash
changelog-gen init
```

## CLI Options

### `changelog-gen generate`

Generate changelog entries from git commits.

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --from <ref>` | Starting point (tag, SHA, or "latest-tag") | Auto-detected |
| `-t, --to <ref>` | End point | HEAD |
| `-o, --output <file>` | Output file path | CHANGELOG.md |
| `-u, --openai-url <url>` | OpenAI API endpoint | https://api.openai.com/v1 |
| `-k, --api-key <key>` | OpenAI API key | OPENAI_API_KEY env |
| `-m, --model <model>` | Model to use | gpt-4o-mini |
| `-v, --version <version>` | Version string | Auto-incremented |
| `-c, --config <file>` | Config file path | .changelogrc.yaml |
| `-d, --dry-run` | Preview without writing | false |

### `changelog-gen init`

Create a default configuration file.

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing config file |

## CI/CD Integration

### GitHub Actions

```yaml
- name: Generate Changelog
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx changelog-gen generate --from latest-tag
```

See [examples/github-action.yml](examples/github-action.yml) for a complete workflow.

### GitLab CI

```yaml
changelog:
  image: node:20
  script:
    - npx changelog-gen generate --from latest-tag
  variables:
    GIT_DEPTH: 0
```

See [examples/gitlab-ci.yml](examples/gitlab-ci.yml) for complete examples.

## Using with Local AI Models

changelog-gen works with any OpenAI-compatible API. To use with local models:

### Ollama

```bash
# Start Ollama with an appropriate model
ollama run llama3.1

# Use with changelog-gen
changelog-gen generate --openai-url http://localhost:11434/v1 --model llama3.1
```

### LM Studio

```bash
# Start LM Studio server, then:
changelog-gen generate --openai-url http://localhost:1234/v1 --model local-model
```

## Output Format

Generated changelogs follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2024-01-15

### Added

- User authentication with OAuth support
- Dark mode theme option

### Changed

- Improved performance of data loading

### Fixed

- Resolved issue with form validation on mobile devices
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (required) |

## License

MIT
