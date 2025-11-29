import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import chalk from 'chalk';
import simpleGit from 'simple-git';
import { getTask } from '../lib/tasks.js';
import { getConfig } from '../lib/config.js';

interface Props {
	task: string;
	stat?: boolean;
}

interface DiffStats {
	filesChanged: number;
	insertions: number;
	deletions: number;
	files: Array<{
		file: string;
		insertions: number;
		deletions: number;
	}>;
}

/**
 * Parse git diff --stat output to extract statistics
 */
function parseDiffStat(output: string): DiffStats {
	const lines = output.trim().split('\n');
	const stats: DiffStats = {
		filesChanged: 0,
		insertions: 0,
		deletions: 0,
		files: [],
	};

	// Parse individual file stats
	for (const line of lines) {
		// Skip the summary line
		if (line.includes('file') && line.includes('changed')) {
			continue;
		}

		// Match pattern like: " src/file.ts | 10 +++++++---"
		const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+([\+\-]+)/);
		if (match) {
			const [, file, changes, symbols] = match;
			const insertions = (symbols.match(/\+/g) || []).length;
			const deletions = (symbols.match(/\-/g) || []).length;

			stats.files.push({
				file: file.trim(),
				insertions,
				deletions,
			});

			stats.insertions += insertions;
			stats.deletions += deletions;
		}
	}

	stats.filesChanged = stats.files.length;

	return stats;
}

/**
 * Get git diff statistics for a worktree
 */
async function getDiffStats(worktreePath: string, baseBranch: string): Promise<DiffStats> {
	const git = simpleGit(worktreePath);

	try {
		// Get diff stat between current branch and base branch
		const output = await git.raw([
			'diff',
			'--stat',
			`${baseBranch}...HEAD`,
		]);

		return parseDiffStat(output);
	} catch (error) {
		throw new Error(`Failed to get diff stats: ${error}`);
	}
}

/**
 * Get full git diff output for a worktree
 */
async function getFullDiff(worktreePath: string, baseBranch: string): Promise<string> {
	const git = simpleGit(worktreePath);

	try {
		// Get full diff between current branch and base branch
		const output = await git.raw([
			'diff',
			`${baseBranch}...HEAD`,
		]);

		return output;
	} catch (error) {
		throw new Error(`Failed to get diff: ${error}`);
	}
}

/**
 * Format diff output with syntax highlighting
 */
function formatDiff(diff: string): string {
	if (!diff.trim()) {
		return '';
	}

	const lines = diff.split('\n');
	const formatted: string[] = [];

	for (const line of lines) {
		if (line.startsWith('diff --git')) {
			formatted.push(chalk.bold.white(line));
		} else if (line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
			formatted.push(chalk.dim(line));
		} else if (line.startsWith('@@')) {
			formatted.push(chalk.cyan(line));
		} else if (line.startsWith('+')) {
			formatted.push(chalk.green(line));
		} else if (line.startsWith('-')) {
			formatted.push(chalk.red(line));
		} else {
			formatted.push(line);
		}
	}

	return formatted.join('\n');
}

/**
 * Diff Command
 * Shows git diff for a task's worktree compared to the base branch
 */
export default function DiffCommand({ task, stat }: Props) {
	const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
	const [errorMessage, setErrorMessage] = useState<string>('');
	const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
	const [diffOutput, setDiffOutput] = useState<string>('');
	const [taskDescription, setTaskDescription] = useState<string>('');

	useEffect(() => {
		async function fetchDiff() {
			try {
				// Find task by slug
				const taskData = await getTask(task);

				if (!taskData) {
					setErrorMessage(`Task "${task}" not found`);
					setStatus('error');
					return;
				}

				// Get base branch from config
				const config = getConfig();
				const baseBranch = config.defaultBaseBranch;

				setTaskDescription(taskData.description);

				if (stat) {
					// Get stats only
					const stats = await getDiffStats(taskData.worktreePath, baseBranch);
					setDiffStats(stats);
				} else {
					// Get full diff
					const diff = await getFullDiff(taskData.worktreePath, baseBranch);

					if (!diff.trim()) {
						setErrorMessage('No changes to show');
						setStatus('error');
						return;
					}

					setDiffOutput(formatDiff(diff));
				}

				setStatus('success');
			} catch (error) {
				if (error instanceof Error) {
					setErrorMessage(error.message);
				} else {
					setErrorMessage(`An unexpected error occurred: ${String(error)}`);
				}
				setStatus('error');
			}
		}

		fetchDiff();
	}, [task, stat]);

	if (status === 'loading') {
		return (
			<Box flexDirection="column">
				<Text>Loading diff for task {chalk.cyan(task)}...</Text>
			</Box>
		);
	}

	if (status === 'error') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="red" bold>Error: </Text>
					<Text>{errorMessage}</Text>
				</Box>
			</Box>
		);
	}

	// Success - show stats
	if (stat && diffStats) {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text bold>Diff Summary for </Text>
					<Text bold color="cyan">{task}</Text>
				</Box>
				<Box marginBottom={1}>
					<Text dimColor>{taskDescription}</Text>
				</Box>

				{diffStats.filesChanged === 0 ? (
					<Box>
						<Text dimColor>No changes</Text>
					</Box>
				) : (
					<>
						<Box marginBottom={1}>
							<Text>
								{chalk.bold(diffStats.filesChanged.toString())}{' '}
								{diffStats.filesChanged === 1 ? 'file' : 'files'} changed,{' '}
								<Text color="green" bold>+{diffStats.insertions}</Text> insertions,{' '}
								<Text color="red" bold>-{diffStats.deletions}</Text> deletions
							</Text>
						</Box>

						<Box flexDirection="column">
							{diffStats.files.map((file, index) => (
								<Box key={index}>
									<Text>
										{chalk.dim(file.file)}{' '}
										<Text color="green">+{file.insertions}</Text>{' '}
										<Text color="red">-{file.deletions}</Text>
									</Text>
								</Box>
							))}
						</Box>
					</>
				)}
			</Box>
		);
	}

	// Success - show full diff
	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text bold>Diff for </Text>
				<Text bold color="cyan">{task}</Text>
			</Box>
			<Box marginBottom={1}>
				<Text dimColor>{taskDescription}</Text>
			</Box>
			<Box flexDirection="column">
				<Text>{diffOutput}</Text>
			</Box>
		</Box>
	);
}
