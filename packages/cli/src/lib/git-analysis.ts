import simpleGit, { SimpleGit } from "simple-git";
import { Task } from "./tasks.js";
import { getDiffStats, getFullDiff, listWorktrees } from "./git.js";
import fs from "fs/promises";
import path from "path";

export interface FileChange {
	path: string;
	type: "added" | "modified" | "deleted";
	additions: number;
	deletions: number;
}

export interface TaskDiffAnalysis {
	task: Task;
	files: FileChange[];
	totalAdditions: number;
	totalDeletions: number;
	fullDiff: string;
}

export interface FileOverlap {
	file: string;
	tasks: string[];
}

/**
 * Get detailed diff analysis for a task
 */
export async function getTaskDiffAnalysis(
	task: Task,
): Promise<TaskDiffAnalysis> {
	const diffStats = await getDiffStats(task.slug);
	const fullDiff = await getFullDiff(task.slug);

	const files: FileChange[] = diffStats.files.map((f) => ({
		path: f.file,
		type: determineChangeType(fullDiff, f.file),
		additions: f.insertions,
		deletions: f.deletions,
	}));

	return {
		task,
		files,
		totalAdditions: diffStats.totalInsertions,
		totalDeletions: diffStats.totalDeletions,
		fullDiff,
	};
}

/**
 * Determine if a file was added, modified, or deleted
 */
function determineChangeType(
	diff: string,
	filename: string,
): "added" | "modified" | "deleted" {
	const lines = diff.split("\n");

	for (let i = 0; i < lines.length; i++) {
		if (lines[i].includes(filename)) {
			// Check the diff header
			if (lines[i].includes("new file")) return "added";
			if (lines[i].includes("deleted file")) return "deleted";
		}
	}

	return "modified";
}

/**
 * Find files that are modified by multiple tasks using existing analyses
 */
export function getOverlappingFiles(
	taskAnalyses: TaskDiffAnalysis[],
): FileOverlap[] {
	const fileMap = new Map<string, Set<string>>();

	// Build map of file -> set of task slugs
	for (const analysis of taskAnalyses) {
		for (const file of analysis.files) {
			if (!fileMap.has(file.path)) {
				fileMap.set(file.path, new Set());
			}
			fileMap.get(file.path)!.add(analysis.task.slug);
		}
	}

	// Find overlaps (files modified by multiple tasks)
	const overlaps: FileOverlap[] = [];

	for (const [file, taskSet] of fileMap.entries()) {
		if (taskSet.size > 1) {
			overlaps.push({
				file,
				tasks: Array.from(taskSet),
			});
		}
	}

	return overlaps;
}

/**
 * Get file contents from a specific task worktree
 */
export async function getFileFromTask(
	task: Task,
	filePath: string,
): Promise<string | null> {
	try {
		const fullPath = path.join(task.worktreePath, filePath);
		return await fs.readFile(fullPath, "utf-8");
	} catch (err) {
		console.error(
			`Failed to read file "${filePath}" from task worktree ${task.slug}:`,
			err,
		);
		return null;
	}
}

/**
 * Get file contents from main branch
 */
export async function getFileFromMain(
	filePath: string,
): Promise<string | null> {
	try {
		const git = simpleGit();
		const repoRoot = (
			await git.revparse(["--show-toplevel"])
		).trim();
		const fullPath = path.join(repoRoot, filePath);
		return await fs.readFile(fullPath, "utf-8");
	} catch (err) {
		console.error(
			`Failed to read file "${filePath}" from main branch worktree:`,
			err,
		);
		return null;
	}
}

/**
 * Get all versions of an overlapping file
 */
export async function getFileVersions(
	file: string,
	tasks: Task[],
): Promise<Map<string, string>> {
	const versions = new Map<string, string>();

	// Get main branch version
	const mainContent = await getFileFromMain(file);
	if (mainContent) {
		versions.set("main", mainContent);
	}

	// Get version from each task
	for (const task of tasks) {
		const content = await getFileFromTask(task, file);
		if (content) {
			versions.set(task.slug, content);
		}
	}

	return versions;
}

/**
 * Analyze all active tasks together
 */
export async function analyzeAllTasks(tasks: Task[]): Promise<{
	taskAnalyses: TaskDiffAnalysis[];
	overlaps: FileOverlap[];
}> {
	const taskAnalyses = await Promise.all(
		tasks.map((task) => getTaskDiffAnalysis(task)),
	);

	const overlaps = getOverlappingFiles(taskAnalyses);

	return {
		taskAnalyses,
		overlaps,
	};
}
