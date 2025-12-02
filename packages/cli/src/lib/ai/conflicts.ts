import { z } from 'zod';
import { generateStructured } from './client.js';
import { ConflictBlock, ConflictResolution } from './types.js';

const ConflictResolutionSchema = z.object({
  file: z.string(),
  analysis: z.string(),
  suggestedResolution: z.string(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

export async function resolveConflict(
  conflict: ConflictBlock,
  fileContext?: string
): Promise<ConflictResolution> {
  const prompt = `Resolve git merge conflict.

File: ${conflict.file} (line ${conflict.startLine})

Main:
\`\`\`
${conflict.mainVersion}
\`\`\`

Feature:
\`\`\`
${conflict.featureVersion}
\`\`\`

${fileContext ? `Context:\n${fileContext}\n` : ''}

Provide:
1. analysis: One sentence explaining conflict
2. suggestedResolution: Resolved code
3. confidence: 0-100
4. reasoning: One sentence why

Be concise. Focus on solution.`;

  const result = await generateStructured(prompt, ConflictResolutionSchema);
  
  return {
    ...result,
    file: conflict.file,
  };
}

export async function resolveAllConflicts(
  conflicts: ConflictBlock[]
): Promise<ConflictResolution[]> {
  return Promise.all(conflicts.map(c => resolveConflict(c)));
}

export function parseConflictMarkers(content: string, filePath: string): ConflictBlock[] {
  const conflicts: ConflictBlock[] = [];
  const lines = content.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const startLine = i;
      let mainVersion = '';
      let featureVersion = '';
      let baseVersion = '';
      
      i++;
      // Read main version
      while (i < lines.length && !lines[i].startsWith('=======')) {
        mainVersion += lines[i] + '\n';
        i++;
      }
      
      i++; // Skip =======
      // Read feature version
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        featureVersion += lines[i] + '\n';
        i++;
      }
      
      conflicts.push({
        file: filePath,
        startLine: startLine + 1,
        mainVersion: mainVersion.trim(),
        featureVersion: featureVersion.trim(),
      });
    }
    i++;
  }
  
  return conflicts;
}
