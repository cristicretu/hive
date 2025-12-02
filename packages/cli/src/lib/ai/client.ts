import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { getConfig } from "../config.js";

let aiClient: ReturnType<typeof createGoogleGenerativeAI> | null = null;

export function getAIClient() {
	if (!aiClient) {
		const config = getConfig();
		const apiKey = config.ai?.apiKey;

		if (!apiKey) {
			throw new Error(
				"AI API key not configured. Set it with: hive config set ai.apiKey YOUR_KEY",
			);
		}

		aiClient = createGoogleGenerativeAI({
			apiKey,
		});
	}

	return aiClient;
}

export function getModel(modelName?: string) {
	const config = getConfig();
	const client = getAIClient();
	const model = modelName || config.ai?.model || "gemini-2.5-flash";

	return client(model);
}

export async function generateStructured<T>(
	prompt: string,
	schema: z.ZodType<T>,
	options?: {
		model?: string;
		temperature?: number;
	},
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
