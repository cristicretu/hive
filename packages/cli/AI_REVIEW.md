# AI Code Review & Conflict Resolution

Hive now includes AI-powered code review and conflict resolution using Google Gemini 2.0 Flash or Gemini 2.5 Pro.

## Setup

### 1. Install Dependencies

Already included in the package:
- `ai` - Vercel AI SDK
- `@ai-sdk/google` - Google AI provider
- `zod` - Schema validation

### 2. Configure API Key

Set your Google AI API key:

```bash
# Option 1: Environment variable (recommended)
export GEMINI_API_KEY="your-key-here"

# Option 2: Save in config
hive config set ai.apiKey "your-key-here"
hive config set ai.enabled true
```

### 3. Enable AI Features

```bash
# Enable AI review
hive config set ai.enabled true

# Set provider (default is google)
hive config set ai.provider google

# Set model (optional)
hive config set ai.model "gemini-2.5-flash"

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
    "provider": "google",
    "apiKey": "your-key-here",
    "model": "gemini-2.5-flash",
    "autoReview": false,
    "autoResolveConflicts": false
  }
}
```

### Options

- `enabled` - Enable/disable AI features
- `provider` - AI provider: "google"
- `apiKey` - Google AI API key (or use env var GEMINI_API_KEY)
- `model` - Gemini model to use:
  - `gemini-2.5-flash` - Fast, efficient (recommended)
  - `gemini-1.5-pro` - More capable
  - `gemini-1.5-flash` - Very fast
- `autoReview` - Automatically review on merge
- `autoResolveConflicts` - Auto-resolve conflicts with AI

## Available Models

- **gemini-2.5-flash** - Latest experimental flash model (default, fastest)
- **gemini-1.5-pro** - Most capable model
- **gemini-1.5-flash** - Fast and efficient
- **gemini-1.5-flash-8b** - Ultra-fast, lighter model

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

Using Google Gemini:
- **gemini-2.5-flash**: Free tier available
- **gemini-1.5-flash**: ~$0.075 per million input tokens
- **gemini-1.5-pro**: ~$1.25 per million input tokens

Average review: 5k-20k tokens = Very affordable!

## Tips

1. **Review before merge** - Catch issues early
2. **Use environment variables** - Don't commit API keys
3. **Check recommendations** - AI is good but not perfect
4. **Combine with tests** - AI + tests = best safety net
5. **Try flash models first** - They're fast and usually good enough

## Troubleshooting

### "GEMINI_API_KEY not found"

Set the API key:
```bash
export GEMINI_API_KEY="your-key-here"
```

Or save in config:
```bash
hive config set ai.apiKey "your-key-here"
```

### Get a Google AI API Key

1. Go to: https://aistudio.google.com/app/apikey
2. Click "Get API Key"
3. Create a new key or use existing
4. Copy and set as environment variable

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
