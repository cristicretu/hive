import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

export type EditorType = 'code' | 'cursor' | 'claude' | 'terminal';

interface EditorConfig {
  command: string;
  args: (path: string) => string[];
  checkAvailable: () => boolean;
}

/**
 * Configuration for each editor type
 */
const EDITOR_CONFIGS: Record<EditorType, EditorConfig> = {
  code: {
    command: 'code',
    args: (path: string) => [path],
    checkAvailable: () => commandExists('code'),
  },
  cursor: {
    command: 'cursor',
    args: (path: string) => [path],
    checkAvailable: () => commandExists('cursor'),
  },
  claude: {
    command: 'claude',
    args: (path: string) => ['-p', path],
    checkAvailable: () => commandExists('claude'),
  },
  terminal: {
    command: process.env.SHELL || 'bash',
    args: () => [],
    checkAvailable: () => true, // Shell is always available
  },
};

/**
 * Check if a command exists in the system PATH
 * @param command - The command to check
 * @returns true if the command exists, false otherwise
 */
function commandExists(command: string): boolean {
  try {
    execSync(`which ${command}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a worktree directory in the specified editor
 * @param path - The absolute path to open
 * @param editor - The editor type to use
 * @throws Error if the path doesn't exist or the editor is not available
 */
export function openInEditor(path: string, editor: EditorType): void {
  // Validate path exists
  if (!existsSync(path)) {
    throw new Error(`Path does not exist: ${path}`);
  }

  const config = EDITOR_CONFIGS[editor];

  // Check if editor is available
  if (!config.checkAvailable()) {
    throw new Error(`Editor '${editor}' is not available on this system`);
  }

  try {
    const args = config.args(path);

    if (editor === 'terminal') {
      // For terminal, spawn an interactive shell in the directory
      const child = spawn(config.command, args, {
        cwd: path,
        stdio: 'inherit',
        detached: false,
      });

      child.on('error', (error) => {
        throw new Error(`Failed to launch terminal: ${error.message}`);
      });
    } else {
      // For other editors, spawn detached process
      const child = spawn(config.command, args, {
        detached: true,
        stdio: 'ignore',
      });

      child.unref(); // Allow parent process to exit independently

      child.on('error', (error) => {
        throw new Error(`Failed to launch ${editor}: ${error.message}`);
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to open ${editor}: ${String(error)}`);
  }
}

/**
 * Detect which editors are available on the system
 * @returns An array of available editor types
 */
export function detectDefaultEditor(): EditorType[] {
  const available: EditorType[] = [];

  for (const [editor, config] of Object.entries(EDITOR_CONFIGS)) {
    if (config.checkAvailable()) {
      available.push(editor as EditorType);
    }
  }

  return available;
}

/**
 * Get the preferred editor based on environment variables and availability
 * @returns The preferred editor type, or undefined if none found
 */
export function getPreferredEditor(): EditorType | undefined {
  // Check for common editor environment variables
  const editorEnv = process.env.EDITOR || process.env.VISUAL;

  if (editorEnv) {
    if (editorEnv.includes('code')) return 'code';
    if (editorEnv.includes('cursor')) return 'cursor';
    if (editorEnv.includes('claude')) return 'claude';
  }

  // Otherwise, return the first available editor in order of preference
  const available = detectDefaultEditor();
  const preferenceOrder: EditorType[] = ['code', 'cursor', 'claude', 'terminal'];

  for (const preferred of preferenceOrder) {
    if (available.includes(preferred)) {
      return preferred;
    }
  }

  return undefined;
}
