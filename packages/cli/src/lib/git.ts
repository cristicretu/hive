import simpleGit, { SimpleGit, DiffResult } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { createSymlinks, formatBytes, type SymlinkResult } from './symlinks.js';
import { getConfig } from './config.js';

/**
 * Interface for worktree information
 */
export interface WorktreeInfo {
  slug: string;
  path: string;
  branch: string;
  head: string;
  detached: boolean;
}

/**
 * Interface for worktree status
 */
export interface WorktreeStatus {
  slug: string;
  path: string;
  branch: string;
  modified: number;
  added: number;
  deleted: number;
  renamed: number;
  staged: number;
  conflicted: number;
  ahead: number;
  behind: number;
  isClean: boolean;
}

/**
 * Interface for diff statistics
 */
export interface DiffStats {
  files: Array<{
    file: string;
    changes: number;
    insertions: number;
    deletions: number;
  }>;
  totalFiles: number;
  totalInsertions: number;
  totalDeletions: number;
  totalChanges: number;
}

/**
 * Interface for branch changes
 */
export interface BranchChanges {
  modified: string[];
  added: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  all: string[];
}

/**
 * Custom error class for git operations
 */
export class GitError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'GitError';
  }
}

/**
 * Get a simple-git instance for a specific directory
 */
function getGit(baseDir?: string): SimpleGit {
  return simpleGit(baseDir || process.cwd());
}

/**
 * Check if the current directory is a git repository
 */
export async function isGitRepository(dir?: string): Promise<boolean> {
  try {
    const git = getGit(dir);
    await git.revparse(['--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the default branch (main or master)
 */
async function getDefaultBranch(git: SimpleGit): Promise<string> {
  try {
    // Try to get the default branch from remote
    const remotes = await git.getRemotes(true);
    if (remotes.length > 0) {
      try {
        const remoteBranches = await git.branch(['-r']);
        if (remoteBranches.all.includes('origin/main')) {
          return 'main';
        } else if (remoteBranches.all.includes('origin/master')) {
          return 'master';
        }
      } catch {
        // Fall through to local branch detection
      }
    }

    // Check local branches
    const branches = await git.branchLocal();
    if (branches.all.includes('main')) {
      return 'main';
    } else if (branches.all.includes('master')) {
      return 'master';
    }

    // Try to get current branch as fallback
    const current = await git.revparse(['--abbrev-ref', 'HEAD']);
    return current.trim();
  } catch (error) {
    throw new GitError('Failed to determine default branch', error);
  }
}

/**
 * Get the repository root directory
 */
async function getRepoRoot(git: SimpleGit): Promise<string> {
  try {
    const root = await git.revparse(['--show-toplevel']);
    return root.trim();
  } catch (error) {
    throw new GitError('Failed to get repository root', error);
  }
}

/**
 * Create a new worktree
 * @param slug - Unique identifier for the worktree
 * @param baseBranch - Base branch to branch from (defaults to main/master)
 * @returns Object with worktree path and symlink result
 */
export async function createWorktree(
  slug: string,
  baseBranch?: string
): Promise<{ path: string; symlinks: SymlinkResult }> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const repoRoot = await getRepoRoot(git);
    const base = baseBranch || (await getDefaultBranch(git));
    const branchName = `hive/${slug}`;
    const worktreePath = path.join(repoRoot, '.worktrees', slug);

    // Check if worktree already exists
    try {
      await fs.access(worktreePath);
      throw new GitError(`Worktree already exists at ${worktreePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // Check if branch already exists
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName)) {
      throw new GitError(`Branch ${branchName} already exists`);
    }

    // Create worktree with new branch
    await git.raw(['worktree', 'add', '-b', branchName, worktreePath, base]);

    // Create symlinks if enabled in config
    const config = getConfig();
    let symlinkResult: SymlinkResult = { created: [], skipped: [], savedBytes: 0 };

    if (config.autoSymlink) {
      symlinkResult = await createSymlinks(repoRoot, worktreePath, config.customSymlinks);
    }

    return { path: worktreePath, symlinks: symlinkResult };
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to create worktree', error);
  }
}

/**
 * Remove a worktree and delete its branch
 * @param slug - Unique identifier for the worktree
 */
export async function removeWorktree(slug: string): Promise<void> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const repoRoot = await getRepoRoot(git);
    const worktreePath = path.join(repoRoot, '.worktrees', slug);
    const branchName = `hive/${slug}`;

    // Check if worktree exists
    const worktrees = await listWorktrees();
    const worktree = worktrees.find((w) => w.slug === slug);

    if (!worktree) {
      throw new GitError(`Worktree ${slug} not found`);
    }

    // Remove worktree
    await git.raw(['worktree', 'remove', worktreePath, '--force']);

    // Delete branch if it exists
    try {
      const branches = await git.branchLocal();
      if (branches.all.includes(branchName)) {
        await git.deleteLocalBranch(branchName, true);
      }
    } catch (error) {
      // Branch might not exist or already deleted, continue
      console.warn(`Warning: Could not delete branch ${branchName}`, error);
    }
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to remove worktree', error);
  }
}

/**
 * List all worktrees
 * @returns Array of worktree information
 */
export async function listWorktrees(): Promise<WorktreeInfo[]> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const repoRoot = await getRepoRoot(git);
    const output = await git.raw(['worktree', 'list', '--porcelain']);

    const worktrees: WorktreeInfo[] = [];
    const lines = output.split('\n');

    let currentWorktree: Partial<WorktreeInfo> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        const worktreePath = line.substring(9);
        currentWorktree.path = worktreePath;

        // Extract slug from path if it's in .worktrees
        if (worktreePath.includes('.worktrees/')) {
          const parts = worktreePath.split('.worktrees/');
          currentWorktree.slug = parts[1] || path.basename(worktreePath);
        } else if (worktreePath === repoRoot) {
          currentWorktree.slug = 'main';
        } else {
          currentWorktree.slug = path.basename(worktreePath);
        }
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7);
        currentWorktree.detached = false;
      } else if (line.startsWith('detached')) {
        currentWorktree.detached = true;
        currentWorktree.branch = currentWorktree.head || 'detached';
      } else if (line === '') {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree as WorktreeInfo);
        }
        currentWorktree = {};
      }
    }

    return worktrees;
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to list worktrees', error);
  }
}

/**
 * Get the status of a specific worktree
 * @param slug - Unique identifier for the worktree
 * @returns Status information for the worktree
 */
export async function getWorktreeStatus(slug: string): Promise<WorktreeStatus> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const worktrees = await listWorktrees();
    const worktree = worktrees.find((w) => w.slug === slug);

    if (!worktree) {
      throw new GitError(`Worktree ${slug} not found`);
    }

    const worktreeGit = getGit(worktree.path);
    const status = await worktreeGit.status();

    // Get ahead/behind info
    let ahead = 0;
    let behind = 0;
    if (status.tracking) {
      ahead = status.ahead;
      behind = status.behind;
    }

    return {
      slug,
      path: worktree.path,
      branch: worktree.branch,
      modified: status.modified.length,
      added: status.created.length,
      deleted: status.deleted.length,
      renamed: status.renamed.length,
      staged: status.staged.length,
      conflicted: status.conflicted.length,
      ahead,
      behind,
      isClean: status.isClean(),
    };
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to get worktree status', error);
  }
}

/**
 * Get diff statistics for a worktree against a base branch
 * @param slug - Unique identifier for the worktree
 * @param baseBranch - Base branch to compare against (defaults to main/master)
 * @returns Diff statistics
 */
export async function getDiffStats(
  slug: string,
  baseBranch?: string
): Promise<DiffStats> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const worktrees = await listWorktrees();
    const worktree = worktrees.find((w) => w.slug === slug);

    if (!worktree) {
      throw new GitError(`Worktree ${slug} not found`);
    }

    const base = baseBranch || (await getDefaultBranch(git));
    const worktreeGit = getGit(worktree.path);

    // Get diff stats
    const diff: DiffResult = await worktreeGit.diffSummary([base]);

    const files = diff.files.map((file) => ({
      file: file.file,
      changes: file.changes,
      insertions: file.insertions,
      deletions: file.deletions,
    }));

    return {
      files,
      totalFiles: diff.files.length,
      totalInsertions: diff.insertions,
      totalDeletions: diff.deletions,
      totalChanges: diff.changed,
    };
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to get diff stats', error);
  }
}

/**
 * Check if a worktree has uncommitted changes
 * @param slug - Unique identifier for the worktree
 * @returns True if there are uncommitted changes
 */
export async function hasUncommittedChanges(slug: string): Promise<boolean> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const worktrees = await listWorktrees();
    const worktree = worktrees.find((w) => w.slug === slug);

    if (!worktree) {
      throw new GitError(`Worktree ${slug} not found`);
    }

    const worktreeGit = getGit(worktree.path);
    const status = await worktreeGit.status();

    return !status.isClean();
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to check for uncommitted changes', error);
  }
}

/**
 * Merge a task branch into a target branch
 * @param slug - Unique identifier for the worktree
 * @param targetBranch - Target branch to merge into (defaults to main/master)
 * @returns Object with success status and conflicts array if any
 */
export async function mergeBranch(
  slug: string,
  targetBranch?: string
): Promise<{ success: boolean; conflicts: string[] }> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const worktrees = await listWorktrees();
    const worktree = worktrees.find((w) => w.slug === slug);

    if (!worktree) {
      throw new GitError(`Worktree ${slug} not found`);
    }

    const target = targetBranch || (await getDefaultBranch(git));
    const branchName = worktree.branch;

    // Check if we're currently on the target branch
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    if (currentBranch.trim() !== target) {
      // Switch to target branch first
      await git.checkout(target);
    }

    // Pull latest changes from remote if tracking
    try {
      await git.pull();
    } catch {
      // Ignore pull errors, might not have remote
    }

    // Attempt to merge the branch
    try {
      await git.merge([branchName]);
      return { success: true, conflicts: [] };
    } catch (error: any) {
      // Check if there are merge conflicts
      const status = await git.status();
      if (status.conflicted.length > 0) {
        return { success: false, conflicts: status.conflicted };
      }
      // If it's not a conflict, it's a different error
      throw error;
    }
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to merge branch', error);
  }
}

/**
 * Abort a merge in progress
 */
export async function abortMerge(): Promise<void> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    await git.raw(['merge', '--abort']);
  } catch (error) {
    // Ignore error if there's no merge in progress
    if (error instanceof Error && !error.message.includes('no merge in progress')) {
      throw new GitError('Failed to abort merge', error);
    }
  }
}

/**
 * List all local branches in the repository
 * @returns Array of branch names
 */
export async function listBranches(): Promise<string[]> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const branches = await git.branchLocal();
    return branches.all;
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to list branches', error);
  }
}

/**
 * Get list of changed files in a worktree
 * @param slug - Unique identifier for the worktree
 * @returns Object containing categorized file changes
 */
export async function getBranchChanges(slug: string): Promise<BranchChanges> {
  try {
    const git = getGit();

    if (!(await isGitRepository())) {
      throw new GitError('Not a git repository');
    }

    const worktrees = await listWorktrees();
    const worktree = worktrees.find((w) => w.slug === slug);

    if (!worktree) {
      throw new GitError(`Worktree ${slug} not found`);
    }

    const worktreeGit = getGit(worktree.path);
    const status = await worktreeGit.status();

    const renamed = status.renamed.map((r) => ({
      from: r.from,
      to: r.to,
    }));

    const all = [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map((r) => r.to),
    ];

    return {
      modified: status.modified,
      added: status.created,
      deleted: status.deleted,
      renamed,
      all,
    };
  } catch (error) {
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError('Failed to get branch changes', error);
  }
}
