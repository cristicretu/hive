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
  const prompt = `Senior code reviewer. Analyze this diff for security, bugs, performance, quality.

Context:
- Files: ${context.files.join(', ')}
- Changes: +${context.additions} -${context.deletions}

Diff:
${diff}

Provide:
1. concerns: Real issues only. Be selective. Title + description + suggestion (all brief)
2. positives: 2-3 max
3. summary: One sentence
4. recommendation: approve | request-changes | comment

Ultra-concise. No fluff. Essential info only.`;

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
