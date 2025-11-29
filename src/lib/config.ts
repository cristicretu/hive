import Conf from 'conf';
import path from 'path';
import { homedir } from 'os';

export type EditorType = 'code' | 'cursor' | 'claude' | 'terminal';

export interface HiveConfig {
  defaultBaseBranch: string;
  defaultEditor: EditorType;
  worktreeDir: string;
}

const DEFAULT_CONFIG: HiveConfig = {
  defaultBaseBranch: 'main',
  defaultEditor: 'code',
  worktreeDir: '.worktrees',
};

const CONFIG_DIR = path.join(process.cwd(), '.hive');

let configStore: Conf<HiveConfig> | null = null;

/**
 * Initialize the config store singleton
 */
function getStore(): Conf<HiveConfig> {
  if (!configStore) {
    configStore = new Conf<HiveConfig>({
      configName: 'config',
      cwd: CONFIG_DIR,
      defaults: DEFAULT_CONFIG,
      projectName: 'hive',
      projectSuffix: '',
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
    defaultBaseBranch: store.get('defaultBaseBranch'),
    defaultEditor: store.get('defaultEditor'),
    worktreeDir: store.get('worktreeDir'),
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
    store.set('defaultBaseBranch', updates.defaultBaseBranch);
  }

  if (updates.defaultEditor !== undefined) {
    const validEditors: EditorType[] = ['code', 'cursor', 'claude', 'terminal'];
    if (!validEditors.includes(updates.defaultEditor)) {
      throw new Error(
        `Invalid editor: ${updates.defaultEditor}. Must be one of: ${validEditors.join(', ')}`
      );
    }
    store.set('defaultEditor', updates.defaultEditor);
  }

  if (updates.worktreeDir !== undefined) {
    store.set('worktreeDir', updates.worktreeDir);
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
  if (!store.has('defaultBaseBranch')) {
    store.set('defaultBaseBranch', DEFAULT_CONFIG.defaultBaseBranch);
  }
  if (!store.has('defaultEditor')) {
    store.set('defaultEditor', DEFAULT_CONFIG.defaultEditor);
  }
  if (!store.has('worktreeDir')) {
    store.set('worktreeDir', DEFAULT_CONFIG.worktreeDir);
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
