# AI Code Review & Conflict Resolution

Hive now includes AI-powered code review and conflict resolution using Claude 3.5 Sonnet.

## Setup

### 1. Install Dependencies

Already included in the package:
- `ai` - Vercel AI SDK
- `@ai-sdk/anthropic` - Anthropic provider
- `zod` - Schema validation

### 2. Configure API Key

Set your Anthropic API key:

```bash
# Option 1: Environment variable (recommended)
export ANTHROPIC_API_KEY="sk-ant-..."

# Option 2: Save in config
hive config set ai.apiKey "sk-ant-..."
hive config set ai.enabled true
```

### 3. Enable AI Features

```bash
# Enable AI review
hive config set ai.enabled true

# Enable auto-review on merge (optional)
hive config set ai.autoReview true
```

## Usage

### Code Review

Review a task before merging:

```bash
hive review <task-name>
```

**Example output:**

```
AI Code Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Authentication implementation looks solid with proper error handling.

Issues Found (2)

[CRITICAL] src/api/auth.ts:45
  Hardcoded JWT secret
  JWT secret should not be hardcoded in source code.
  → Move to environment variable: process.env.JWT_SECRET

[WARNING] src/components/LoginForm.tsx
  Missing error handling
  Network requests should be wrapped in try-catch.
  → Add error boundary and user-facing error messages

Positive
✓ Good TypeScript type coverage
✓ Proper component separation
✓ Clear naming conventions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recommendation: REQUEST CHANGES
```

### Merge with AI Review (Coming Soon)

```bash
# Review and merge in one step
hive merge <task> --ai-review

# Auto-resolve conflicts with AI
hive merge <task> --auto-resolve
```

## Configuration Options

```json
{
  "ai": {
    "enabled": true,
    "apiKey": "sk-ant-...",
    "model": "claude-3-5-sonnet-20241022",
    "autoReview": false,
    "autoResolveConflicts": false
  }
}
```

### Options

- `enabled` - Enable/disable AI features
- `apiKey` - Anthropic API key (or use env var)
- `model` - Claude model to use
- `autoReview` - Automatically review on merge
- `autoResolveConflicts` - Auto-resolve conflicts with AI

## How It Works

### Code Review

1. Analyzes git diff between task branch and main
2. Checks for:
   - Security vulnerabilities
   - Bug risks
   - Code quality issues
   - Performance concerns
3. Provides actionable suggestions
4. Recommends approve/request-changes/comment

### Conflict Resolution (Coming Soon)

1. Detects merge conflicts
2. Analyzes both versions
3. Understands context and intent
4. Suggests resolution
5. Shows confidence level

## Cost

Using Claude 3.5 Sonnet:
- ~$3 per million input tokens
- Average review: 5k-20k tokens = $0.015-$0.06
- Monthly (50 reviews): ~$1-3

Very affordable for the value!

## Tips

1. **Review before merge** - Catch issues early
2. **Use environment variables** - Don't commit API keys
3. **Check recommendations** - AI is good but not perfect
4. **Combine with tests** - AI + tests = best safety net

## Troubleshooting

### "ANTHROPIC_API_KEY not found"

Set the API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or save in config:
```bash
hive config set ai.apiKey "sk-ant-..."
```

### "No changes to review"

Make sure your task has commits:
```bash
cd .worktrees/<task-name>
# Make changes
git add .
git commit -m "changes"
```

## Future Features

- [ ] Auto-fix issues
- [ ] Interactive conflict resolution
- [ ] Test generation suggestions
- [ ] Multi-task review (batch)
- [ ] Learning from past reviews
- [ ] Custom review rules
