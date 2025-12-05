import Conf from "conf";
import path from "path";
import { homedir } from "os";

export type EditorType = "code" | "cursor" | "claude" | "terminal";

export interface HiveConfig {
	defaultBaseBranch: string;
	defaultEditor: EditorType;
	worktreeDir: string;
	autoSymlink: boolean;
	customSymlinks: string[];
	autoCleanStaleDays: number | null;
	ai?: AIConfig;
}

export type AIProvider = "anthropic" | "google" | "openai";
const VALID_AI_PROVIDERS: AIProvider[] = ["anthropic", "google", "openai"];

export interface AIConfig {
	enabled: boolean;
	provider: AIProvider;
	apiKey?: string;
	model: string;
	autoReview: boolean;
	autoResolveConflicts: boolean;
}

export const DEFAULT_AI_MODELS: Record<AIProvider, string> = {
	google: "gemini-2.5-pro",
	anthropic: "claude-sonnet-4-5",
	openai: "gpt-5",
};

const DEFAULT_AI_CONFIG: AIConfig = {
	enabled: false,
	provider: "anthropic",
	model: DEFAULT_AI_MODELS.anthropic,
	autoReview: false,
	autoResolveConflicts: false,
};

const DEFAULT_CONFIG: HiveConfig = {
	defaultBaseBranch: "main",
	defaultEditor: "code",
	worktreeDir: ".worktrees",
	autoSymlink: true,
	customSymlinks: [],
	autoCleanStaleDays: null,
	ai: DEFAULT_AI_CONFIG,
};

const CONFIG_DIR = path.join(process.cwd(), ".hive");

let configStore: Conf<HiveConfig> | null = null;

/**
 * Initialize the config store singleton
 */
function getStore(): Conf<HiveConfig> {
	if (!configStore) {
		configStore = new Conf<HiveConfig>({
			configName: "config",
			cwd: CONFIG_DIR,
			defaults: DEFAULT_CONFIG,
			projectName: "hive",
			projectSuffix: "",
			clearInvalidConfig: true,
			accessPropertiesByDotNotation: false,
		});
	}
	return configStore;
}

/**
 * Get the current configuration
 * @returns The current Hive configuration
 */
export function getConfig(): HiveConfig {
	const store = getStore();
	return {
		defaultBaseBranch: store.get("defaultBaseBranch"),
		defaultEditor: store.get("defaultEditor"),
		worktreeDir: store.get("worktreeDir"),
		autoSymlink: store.get("autoSymlink"),
		customSymlinks: store.get("customSymlinks"),
		autoCleanStaleDays: store.get("autoCleanStaleDays"),
		ai: store.get("ai"),
	};
}

/**
 * Update configuration with partial updates
 * @param updates Partial configuration updates
 * @returns The updated configuration
 */
export function setConfig(updates: Partial<HiveConfig>): HiveConfig {
	const store = getStore();

	if (updates.defaultBaseBranch !== undefined) {
		store.set("defaultBaseBranch", updates.defaultBaseBranch);
	}

	if (updates.defaultEditor !== undefined) {
		const validEditors: EditorType[] = [
			"code",
			"cursor",
			"claude",
			"terminal",
		];
		if (!validEditors.includes(updates.defaultEditor)) {
			throw new Error(
				`Invalid editor: ${updates.defaultEditor}. Must be one of: ${validEditors.join(", ")}`,
			);
		}
		store.set("defaultEditor", updates.defaultEditor);
	}

	if (updates.worktreeDir !== undefined) {
		store.set("worktreeDir", updates.worktreeDir);
	}

	if (updates.autoSymlink !== undefined) {
		store.set("autoSymlink", updates.autoSymlink);
	}

	if (updates.customSymlinks !== undefined) {
		store.set("customSymlinks", updates.customSymlinks);
	}

	if (updates.autoCleanStaleDays !== undefined) {
		store.set("autoCleanStaleDays", updates.autoCleanStaleDays);
	}

	if (updates.ai !== undefined) {
		const aiUpdates = { ...updates.ai };

		if (aiUpdates.provider) {
			aiUpdates.provider =
				aiUpdates.provider.toLowerCase() as AIProvider;
		}

		if (
			aiUpdates.provider &&
			!VALID_AI_PROVIDERS.includes(aiUpdates.provider)
		) {
			throw new Error(
				`Invalid AI provider: ${aiUpdates.provider}. Must be one of: ${VALID_AI_PROVIDERS.join(", ")}`,
			);
		}
		store.set("ai", aiUpdates);
	}

	return getConfig();
}

/**
 * Initialize configuration with defaults if not exists
 * @returns The initialized configuration
 */
export function initConfig(): HiveConfig {
	const store = getStore();

	// Ensure all default values are set
	if (!store.has("defaultBaseBranch")) {
		store.set(
			"defaultBaseBranch",
			DEFAULT_CONFIG.defaultBaseBranch,
		);
	}
	if (!store.has("defaultEditor")) {
		store.set("defaultEditor", DEFAULT_CONFIG.defaultEditor);
	}
	if (!store.has("worktreeDir")) {
		store.set("worktreeDir", DEFAULT_CONFIG.worktreeDir);
	}
	if (!store.has("autoSymlink")) {
		store.set("autoSymlink", DEFAULT_CONFIG.autoSymlink);
	}
	if (!store.has("customSymlinks")) {
		store.set("customSymlinks", DEFAULT_CONFIG.customSymlinks);
	}
	if (!store.has("autoCleanStaleDays")) {
		store.set(
			"autoCleanStaleDays",
			DEFAULT_CONFIG.autoCleanStaleDays,
		);
	}
	if (!store.has("ai")) {
		store.set("ai", DEFAULT_CONFIG.ai);
	}

	return getConfig();
}

/**
 * Reset configuration to defaults
 * @returns The reset configuration
 */
export function resetConfig(): HiveConfig {
	const store = getStore();
	store.clear();
	return initConfig();
}

/**
 * Get the path to the configuration file
 * @returns Absolute path to config.json
 */
export function getConfigPath(): string {
	return getStore().path;
}
