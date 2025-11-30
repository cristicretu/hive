import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Project type detection and symlink configuration
 */
interface ProjectConfig {
	files: string[];
	symlinks: string[];
}

const PROJECT_DETECTORS: Record<string, ProjectConfig> = {
	node: {
		files: ['package.json'],
		symlinks: ['node_modules', '.next', '.turbo', 'dist', '.output', '.nuxt', '.svelte-kit'],
	},
	python: {
		files: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py'],
		symlinks: ['venv', '.venv', '__pycache__', '.pytest_cache', '.mypy_cache'],
	},
	rust: {
		files: ['Cargo.toml'],
		symlinks: ['target'],
	},
	go: {
		files: ['go.mod'],
		symlinks: ['vendor'],
	},
	java: {
		files: ['build.gradle', 'pom.xml'],
		symlinks: ['.gradle', 'build', 'target'],
	},
	ios: {
		files: ['Podfile'],
		symlinks: ['Pods'],
	},
	general: {
		files: [],
		symlinks: ['build', '.cache'],
	},
};

/**
 * Result of symlink creation
 */
export interface SymlinkResult {
	created: string[];
	skipped: string[];
	savedBytes: number;
}

/**
 * Create symlinks from main repo to worktree for heavy directories
 * @param mainRepoPath Path to the main repository
 * @param worktreePath Path to the worktree
 * @param customSymlinks Additional directories to symlink
 * @returns Result with created symlinks and saved space
 */
export async function createSymlinks(
	mainRepoPath: string,
	worktreePath: string,
	customSymlinks: string[] = []
): Promise<SymlinkResult> {
	const result: SymlinkResult = { created: [], skipped: [], savedBytes: 0 };

	// Detect project types and collect directories to symlink
	const dirsToSymlink = new Set<string>();

	for (const [_type, config] of Object.entries(PROJECT_DETECTORS)) {
		const hasProjectFile =
			config.files.length === 0 ||
			config.files.some((f) => {
				try {
					return fsSync.existsSync(path.join(mainRepoPath, f));
				} catch {
					return false;
				}
			});

		if (hasProjectFile) {
			config.symlinks.forEach((dir) => dirsToSymlink.add(dir));
		}
	}

	// Add custom symlinks
	customSymlinks.forEach((dir) => dirsToSymlink.add(dir));

	// Create symlinks for each detected directory
	for (const dir of dirsToSymlink) {
		const sourcePath = path.join(mainRepoPath, dir);
		const targetPath = path.join(worktreePath, dir);

		try {
			// Check if source exists
			const sourceExists = fsSync.existsSync(sourcePath);
			if (!sourceExists) {
				result.skipped.push(dir);
				continue;
			}

			// Check if target already exists
			const targetExists = fsSync.existsSync(targetPath);
			if (targetExists) {
				result.skipped.push(dir);
				continue;
			}

			// Get size of source directory
			const size = await getDirSize(sourcePath);

			// Create relative symlink
			const relativePath = path.relative(path.dirname(targetPath), sourcePath);
			await fs.symlink(relativePath, targetPath, 'dir');

			result.created.push(dir);
			result.savedBytes += size;
		} catch (error) {
			// Skip on error, don't fail the whole operation
			result.skipped.push(dir);
		}
	}

	return result;
}

/**
 * Get the size of a directory in bytes
 * @param dirPath Path to the directory
 * @returns Size in bytes
 */
async function getDirSize(dirPath: string): Promise<number> {
	try {
		// Use du command for speed
		const output = execSync(`du -sb "${dirPath}" 2>/dev/null | cut -f1`, {
			encoding: 'utf8',
		});
		return parseInt(output.trim()) || 0;
	} catch {
		return 0;
	}
}

/**
 * Format bytes to human-readable string
 * @param bytes Number of bytes
 * @returns Formatted string
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return bytes + ' B';
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
	if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Check if a path is a symlink
 * @param targetPath Path to check
 * @returns True if the path is a symlink
 */
export async function isSymlink(targetPath: string): Promise<boolean> {
	try {
		const stats = await fs.lstat(targetPath);
		return stats.isSymbolicLink();
	} catch {
		return false;
	}
}

/**
 * Get disk usage of a directory (following symlinks)
 * @param dirPath Path to the directory
 * @returns Size in bytes (0 if directory doesn't exist or is a symlink)
 */
export async function getActualDiskUsage(dirPath: string): Promise<number> {
	try {
		// Check if path is a symlink
		const isLink = await isSymlink(dirPath);
		if (isLink) {
			return 0; // Don't count symlinks
		}

		return await getDirSize(dirPath);
	} catch {
		return 0;
	}
}
