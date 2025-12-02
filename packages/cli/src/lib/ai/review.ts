import { z } from 'zod';
import { generateStructured } from './client.js';
import { ReviewResult, ReviewConcern } from './types.js';

const ReviewConcernSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']),
  file: z.string(),
  line: z.number().optional(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().optional(),
});

const ReviewResultSchema = z.object({
  concerns: z.array(ReviewConcernSchema),
  positives: z.array(z.string()),
  summary: z.string(),
  recommendation: z.enum(['approve', 'request-changes', 'comment']),
});

export async function reviewCode(
  diff: string,
  context: {
    files: string[];
    additions: number;
    deletions: number;
  }
): Promise<ReviewResult> {
  const prompt = `You are a senior code reviewer analyzing a git diff. Review for security, bugs, performance, and code quality.

Context:
- Files changed: ${context.files.join(', ')}
- Lines: +${context.additions} -${context.deletions}

Diff:
${diff}

Provide:
1. "concerns" - Critical issues, warnings, and suggestions (be selective, only mention real issues)
2. "positives" - What's well done (2-3 items max)
3. "summary" - One sentence overview
4. "recommendation" - approve | request-changes | comment

Be concise and professional. Focus on significant issues.`;

  return generateStructured(prompt, ReviewResultSchema);
}

export async function reviewMultipleFiles(
  files: Array<{ path: string; diff: string }>
): Promise<ReviewResult> {
  const allDiffs = files.map(f => `File: ${f.path}\n${f.diff}`).join('\n\n');
  
  return reviewCode(allDiffs, {
    files: files.map(f => f.path),
    additions: files.reduce((sum, f) => sum + (f.diff.match(/^\+/gm)?.length || 0), 0),
    deletions: files.reduce((sum, f) => sum + (f.diff.match(/^-/gm)?.length || 0), 0),
  });
}
