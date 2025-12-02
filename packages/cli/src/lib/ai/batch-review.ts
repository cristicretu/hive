import { z } from 'zod';
import { generateStructured } from './client.js';
import { Task } from '../tasks.js';
import { TaskDiffAnalysis, FileOverlap, getFileVersions } from '../git-analysis.js';

const TaskSummarySchema = z.object({
  slug: z.string(),
  summary: z.string(),
  impact: z.enum(['low', 'medium', 'high']),
  concerns: z.array(z.string()),
});

const ConflictPredictionSchema = z.object({
  file: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
  conflictType: z.string(),
  analysis: z.string(),
  suggestedResolution: z.string(),
  affectedTasks: z.array(z.string()),
});

const MergeStrategySchema = z.object({
  recommendedOrder: z.array(z.string()),
  reasoning: z.string(),
  estimatedDifficulty: z.enum(['easy', 'medium', 'hard']),
  alternatives: z.array(z.string()).optional(),
});

const SyncReportSchema = z.object({
  taskSummaries: z.array(TaskSummarySchema),
  conflicts: z.array(ConflictPredictionSchema),
  mergeStrategy: MergeStrategySchema,
  overallAssessment: z.string(),
});

export interface TaskSummary {
  slug: string;
  summary: string;
  impact: 'low' | 'medium' | 'high';
  concerns: string[];
}

export interface ConflictPrediction {
  file: string;
  severity: 'critical' | 'warning' | 'info';
  conflictType: string;
  analysis: string;
  suggestedResolution: string;
  affectedTasks: string[];
}

export interface MergeStrategy {
  recommendedOrder: string[];
  reasoning: string;
  estimatedDifficulty: 'easy' | 'medium' | 'hard';
  alternatives?: string[];
}

export interface SyncReport {
  taskSummaries: TaskSummary[];
  conflicts: ConflictPrediction[];
  mergeStrategy: MergeStrategy;
  overallAssessment: string;
}

/**
 * Analyze multiple tasks together to predict conflicts and suggest merge strategy
 */
export async function analyzeBatchTasks(
  taskAnalyses: TaskDiffAnalysis[],
  overlaps: FileOverlap[]
): Promise<SyncReport> {
  // Build comprehensive prompt
  let prompt = `You are a master code reviewer analyzing multiple parallel development tasks that need to be merged into the main branch.

TASKS:
`;

  // Add each task's information
  for (const analysis of taskAnalyses) {
    const filesList = analysis.files
      .map(f => `  • ${f.path} (${f.type}, +${f.additions} -${f.deletions})`)
      .join('\n');
    
    prompt += `
${analysis.task.slug}:
  Description: ${analysis.task.description}
  Files changed: ${analysis.files.length}
${filesList}
  Total: +${analysis.totalAdditions} -${analysis.totalDeletions}
`;
  }

  // Add overlap information
  if (overlaps.length > 0) {
    prompt += `\nOVERLAPPING FILES (modified by multiple tasks):
`;
    for (const overlap of overlaps) {
      prompt += `  • ${overlap.file}
    Modified by: ${overlap.tasks.join(', ')}
    Type: ${overlap.changeType}
`;
    }
  }

  prompt += `
ANALYZE AND PROVIDE:

1. Task Summaries:
   For each task, provide:
   - Brief summary of what it accomplishes (1-2 sentences)
   - Impact level (low/medium/high)
   - Any concerns or issues

2. Conflict Predictions:
   For overlapping files, predict:
   - Severity (critical/warning/info)
   - Type of conflict
   - Analysis of what might conflict
   - Specific resolution strategy
   - Which tasks are affected

3. Merge Strategy:
   - Recommended merge order with reasoning
   - Estimated difficulty (easy/medium/hard)
   - Alternative approaches if applicable

4. Overall Assessment:
   One paragraph summarizing the situation and next steps.

Be concise, professional, and actionable. Focus on helping the user merge safely.`;

  return generateStructured(prompt, SyncReportSchema);
}

/**
 * Analyze detailed conflict for a specific overlapping file
 */
export async function analyzeDetailedConflict(
  file: string,
  tasks: Task[]
): Promise<ConflictPrediction> {
  const versions = await getFileVersions(file, tasks);
  
  let prompt = `Analyze a potential merge conflict for file: ${file}

This file is being modified by ${tasks.length} parallel tasks.

`;

  // Add each version
  for (const [source, content] of versions.entries()) {
    prompt += `
Version from ${source}:
\`\`\`
${content.slice(0, 2000)}${content.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`;
  }

  prompt += `
Analyze this conflict and provide:
- severity: How serious is this conflict? (critical/warning/info)
- conflictType: What kind of conflict? (e.g., "structural change", "dependency update", "logic modification")
- analysis: Brief explanation of the conflict (2-3 sentences)
- suggestedResolution: Specific steps to resolve (be concrete)
- affectedTasks: Which tasks are involved

Be specific and actionable.`;

  const ConflictSchema = z.object({
    file: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    conflictType: z.string(),
    analysis: z.string(),
    suggestedResolution: z.string(),
    affectedTasks: z.array(z.string()),
  });

  const result = await generateStructured(prompt, ConflictSchema);
  
  return {
    ...result,
    file,
    affectedTasks: tasks.map(t => t.slug),
  };
}
