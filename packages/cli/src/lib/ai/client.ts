import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getConfig } from '../config.js';

let anthropicClient: ReturnType<typeof createAnthropic> | null = null;

export function getAIClient() {
  if (!anthropicClient) {
    const config = getConfig();
    const apiKey = process.env.ANTHROPIC_API_KEY || config.ai?.apiKey;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found. Set it in environment or run: hive config set ai.apiKey YOUR_KEY');
    }

    anthropicClient = createAnthropic({
      apiKey,
    });
  }

  return anthropicClient;
}

export function getModel(modelName?: string) {
  const config = getConfig();
  const client = getAIClient();
  const model = modelName || config.ai?.model || 'claude-3-5-sonnet-20241022';
  
  return client(model);
}

export async function generateStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<T> {
  const model = getModel(options?.model);

  const result = await generateObject({
    model,
    schema,
    prompt,
    temperature: options?.temperature ?? 0.3,
  });

  return result.object;
}
