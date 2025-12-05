import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { AIProvider, getConfig, DEFAULT_AI_MODELS } from "../config.js";

type AIClient =
	| ReturnType<typeof createGoogleGenerativeAI>
	| ReturnType<typeof createAnthropic>
	| ReturnType<typeof createOpenAI>;

let aiClient: AIClient | null = null;

function getDefaultModel(provider: AIProvider): string {
	return DEFAULT_AI_MODELS[provider];
}

export function getAIClient() {
	const config = getConfig();
	const ai = config.ai;

	if (!ai || ai.enabled !== true) {
		throw new Error(
			"AI is disabled. Enable it with: hive config set ai.enabled true",
		);
	}

	if (!ai.provider) {
		throw new Error(
			`AI provider not configured. Set it with: hive config set ai.provider`,
		);
	}

	if (!ai.apiKey) {
		throw new Error(
			`AI API key not configured for provider "${ai.provider}". Set it with: hive config set ai.apiKey YOUR_KEY`,
		);
	}

	switch (ai.provider) {
		case "google":
			aiClient = createGoogleGenerativeAI({
				apiKey: ai.apiKey,
			});
			break;
		case "anthropic":
			aiClient = createAnthropic({ apiKey: ai.apiKey });
			break;
		case "openai":
			aiClient = createOpenAI({ apiKey: ai.apiKey });
			break;
		default:
			throw new Error(
				`Unsupported AI provider "${ai.provider}". Please set ai.provider to one of: google, anthropic, openai`,
			);
	}
	return aiClient;
}

export function getModel(modelName?: string) {
	const config = getConfig();
	const client = getAIClient();

	if (!config.ai?.provider) {
		throw new Error(
			`AI provider not configured. Set it with: hive config set ai.provider`,
		);
	}

	const model =
		modelName ||
		config.ai?.model ||
		getDefaultModel(config.ai.provider);

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
