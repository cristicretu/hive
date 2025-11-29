import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import { getTask, updateTask } from '../lib/tasks.js';
import { getConfig } from '../lib/config.js';
import {
	getDiffStats,
	mergeBranch,
	hasUncommittedChanges,
	removeWorktree,
	abortMerge,
} from '../lib/git.js';

interface Props {
	task: string;
	noDelete?: boolean;
}

type Status =
	| 'loading'
	| 'checking'
	| 'confirming'
	| 'merging'
	| 'success'
	| 'conflict'
	| 'error';

interface DiffStatsData {
	totalFiles: number;
	totalInsertions: number;
	totalDeletions: number;
}

/**
 * Merge Command
 * Merges a task branch back into main and optionally removes the worktree
 */
export default function MergeCommand({ task, noDelete = false }: Props) {
	const { exit } = useApp();
	const [status, setStatus] = useState<Status>('loading');
	const [errorMessage, setErrorMessage] = useState<string>('');
	const [taskDescription, setTaskDescription] = useState<string>('');
	const [diffStats, setDiffStats] = useState<DiffStatsData | null>(null);
	const [conflicts, setConflicts] = useState<string[]>([]);
	const [baseBranch, setBaseBranch] = useState<string>('');
	const [taskBranch, setTaskBranch] = useState<string>('');

	useEffect(() => {
		async function loadTaskInfo() {
			try {
				// Find task by slug
				const taskData = await getTask(task);

				if (!taskData) {
					setErrorMessage(`Task "${task}" not found`);
					setStatus('error');
					return;
				}

				// Check if task is active
				if (taskData.status !== 'active') {
					setErrorMessage(
						`Task "${task}" is ${taskData.status}. Only active tasks can be merged.`
					);
					setStatus('error');
					return;
				}

				setTaskDescription(taskData.description);
				setTaskBranch(taskData.branch);

				// Get base branch from config
				const config = getConfig();
				const base = config.defaultBaseBranch;
				setBaseBranch(base);

				// Check for uncommitted changes
				setStatus('checking');
				const hasChanges = await hasUncommittedChanges(task);

				if (hasChanges) {
					setErrorMessage(
						`Task "${task}" has uncommitted changes. Please commit or stash your changes before merging.`
					);
					setStatus('error');
					return;
				}

				// Get diff statistics
				const stats = await getDiffStats(task, base);
				setDiffStats({
					totalFiles: stats.totalFiles,
					totalInsertions: stats.totalInsertions,
					totalDeletions: stats.totalDeletions,
				});

				// Show confirmation
				setStatus('confirming');
			} catch (error) {
				if (error instanceof Error) {
					setErrorMessage(error.message);
				} else {
					setErrorMessage(`An unexpected error occurred: ${String(error)}`);
				}
				setStatus('error');
			}
		}

		loadTaskInfo();
	}, [task]);

	// Handle user input for confirmation
	useInput(
		(input, key) => {
			if (status === 'confirming') {
				if (input === 'y' || input === 'Y') {
					handleMerge();
				} else if (input === 'n' || input === 'N' || key.escape) {
					exit();
				}
			} else if (status === 'conflict' || status === 'success' || status === 'error') {
				// Any key to exit after final status
				exit();
			}
		},
		{ isActive: status === 'confirming' || status === 'conflict' || status === 'success' || status === 'error' }
	);

	async function handleMerge() {
		setStatus('merging');

		try {
			// Attempt merge
			const result = await mergeBranch(task, baseBranch);

			if (!result.success) {
				// Merge conflicts detected
				setConflicts(result.conflicts);
				setStatus('conflict');
				return;
			}

			// Update task status to merged
			await updateTask(task, { status: 'merged' });

			// Remove worktree unless --no-delete flag is set
			if (!noDelete) {
				await removeWorktree(task);
			}

			setStatus('success');
		} catch (error) {
			// Attempt to abort merge if something went wrong
			try {
				await abortMerge();
			} catch {
				// Ignore abort errors
			}

			if (error instanceof Error) {
				setErrorMessage(error.message);
			} else {
				setErrorMessage(`Failed to merge: ${String(error)}`);
			}
			setStatus('error');
		}
	}

	// Render loading state
	if (status === 'loading' || status === 'checking') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text>
						{' '}
						{status === 'loading' ? 'Loading task information...' : 'Checking for uncommitted changes...'}
					</Text>
				</Box>
			</Box>
		);
	}

	// Render error state
	if (status === 'error') {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text color="red" bold>
						Error:{' '}
					</Text>
					<Text>{errorMessage}</Text>
				</Box>
				<Box>
					<Text dimColor>Press any key to exit</Text>
				</Box>
			</Box>
		);
	}

	// Render confirmation prompt
	if (status === 'confirming' && diffStats) {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text bold>Merge Task: </Text>
					<Text bold color="cyan">
						{task}
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text dimColor>{taskDescription}</Text>
				</Box>

				<Box marginBottom={1} flexDirection="column">
					<Text bold>Changes to merge:</Text>
					<Box marginLeft={2}>
						<Text>
							{diffStats.totalFiles} {diffStats.totalFiles === 1 ? 'file' : 'files'} changed,{' '}
							<Text color="green" bold>
								+{diffStats.totalInsertions}
							</Text>{' '}
							insertions,{' '}
							<Text color="red" bold>
								-{diffStats.totalDeletions}
							</Text>{' '}
							deletions
						</Text>
					</Box>
				</Box>

				<Box marginBottom={1} flexDirection="column">
					<Text>
						<Text bold>Branch: </Text>
						<Text color="magenta">{taskBranch}</Text>
						<Text> → </Text>
						<Text color="magenta">{baseBranch}</Text>
					</Text>
					{!noDelete && (
						<Text dimColor>Worktree will be removed after successful merge</Text>
					)}
					{noDelete && (
						<Text dimColor>Worktree will be kept after merge (--no-delete)</Text>
					)}
				</Box>

				<Box marginTop={1}>
					<Text bold>
						Proceed with merge? {chalk.green('[y]')}es / {chalk.red('[n]')}o
					</Text>
				</Box>
			</Box>
		);
	}

	// Render merging state
	if (status === 'merging') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text> Merging branch...</Text>
				</Box>
			</Box>
		);
	}

	// Render conflict state
	if (status === 'conflict') {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text color="yellow" bold>
						Merge Conflicts Detected
					</Text>
				</Box>

				<Box marginBottom={1} flexDirection="column">
					<Text>The following files have conflicts:</Text>
					<Box flexDirection="column" marginLeft={2} marginTop={1}>
						{conflicts.map((file, index) => (
							<Text key={index} color="red">
								• {file}
							</Text>
						))}
					</Box>
				</Box>

				<Box marginBottom={1} flexDirection="column">
					<Text bold>To resolve conflicts:</Text>
					<Box flexDirection="column" marginLeft={2} marginTop={1}>
						<Text>1. Review the conflicted files listed above</Text>
						<Text>2. Resolve conflicts manually in your editor</Text>
						<Text>3. Stage the resolved files: {chalk.cyan('git add <file>')}</Text>
						<Text>4. Complete the merge: {chalk.cyan('git commit')}</Text>
						<Text>5. Then run: {chalk.cyan(`hive merge ${task}`)} again</Text>
					</Box>
				</Box>

				<Box marginTop={1}>
					<Text dimColor>
						Note: The merge has been aborted. Worktree has not been removed.
					</Text>
				</Box>

				<Box marginTop={1}>
					<Text dimColor>Press any key to exit</Text>
				</Box>
			</Box>
		);
	}

	// Render success state
	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text color="green" bold>
					Successfully merged task!
				</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				<Box>
					<Box width={20}>
						<Text color="gray">Task:</Text>
					</Box>
					<Text color="cyan" bold>
						{task}
					</Text>
				</Box>
				<Box>
					<Box width={20}>
						<Text color="gray">Description:</Text>
					</Box>
					<Text>{taskDescription}</Text>
				</Box>
				<Box>
					<Box width={20}>
						<Text color="gray">Branch:</Text>
					</Box>
					<Text color="magenta">{taskBranch}</Text>
					<Text> → </Text>
					<Text color="magenta">{baseBranch}</Text>
				</Box>
				<Box>
					<Box width={20}>
						<Text color="gray">Status:</Text>
					</Box>
					<Text color="green">Merged</Text>
				</Box>
			</Box>

			{diffStats && (
				<Box marginBottom={1}>
					<Text dimColor>
						Changes: {diffStats.totalFiles} {diffStats.totalFiles === 1 ? 'file' : 'files'},{' '}
						<Text color="green">+{diffStats.totalInsertions}</Text>,{' '}
						<Text color="red">-{diffStats.totalDeletions}</Text>
					</Text>
				</Box>
			)}

			{!noDelete && (
				<Box>
					<Text dimColor>Worktree has been removed</Text>
				</Box>
			)}
			{noDelete && (
				<Box>
					<Text dimColor>Worktree has been kept (--no-delete)</Text>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>Press any key to exit</Text>
			</Box>
		</Box>
	);
}
