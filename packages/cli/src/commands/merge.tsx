import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
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
	listBranches,
} from '../lib/git.js';

interface Props {
	task: string;
	noDelete?: boolean;
	onCancel?: () => void;
}

type Status =
	| 'loading'
	| 'checking'
	| 'selectBranch'
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
 * Merges a task branch into a selected target branch with autocomplete
 */
export default function MergeCommand({ task, noDelete = false, onCancel }: Props) {
	const { exit } = useApp();
	const [status, setStatus] = useState<Status>('loading');
	const [errorMessage, setErrorMessage] = useState<string>('');
	const [taskDescription, setTaskDescription] = useState<string>('');
	const [diffStats, setDiffStats] = useState<DiffStatsData | null>(null);
	const [conflicts, setConflicts] = useState<string[]>([]);
	const [taskBranch, setTaskBranch] = useState<string>('');
	const [targetBranch, setTargetBranch] = useState<string>('');
	const [branchInput, setBranchInput] = useState<string>('');
	const [allBranches, setAllBranches] = useState<string[]>([]);
	const [selectedBranchIndex, setSelectedBranchIndex] = useState<number>(0);

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

				// Load all branches
				const branches = await listBranches();
				setAllBranches(branches);

				// Get default branch from config for selection index
				const config = getConfig();
				const defaultBranch = config.defaultBaseBranch;

				// Find default branch index but don't prefill input
				const defaultIndex = branches.findIndex(b => b === defaultBranch);
				setSelectedBranchIndex(defaultIndex >= 0 ? defaultIndex : 0);

				// Move to branch selection
				setStatus('selectBranch');
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

	// Get filtered branches based on input
	const filteredBranches = allBranches.filter(branch =>
		branch.toLowerCase().includes(branchInput.toLowerCase())
	);

	// Handle user input for branch selection
	useInput(
		(input, key) => {
			if (status === 'selectBranch') {
				if (key.return) {
					// User pressed enter - proceed with selected or typed branch
					handleBranchSelected();
				} else if (key.upArrow) {
					setSelectedBranchIndex(Math.max(0, selectedBranchIndex - 1));
				} else if (key.downArrow) {
					setSelectedBranchIndex(Math.min(filteredBranches.length - 1, selectedBranchIndex + 1));
				} else if (key.escape) {
					if (onCancel) {
						onCancel();
					} else {
						exit();
					}
				}
			} else if (status === 'confirming') {
				if (input === 'y' || input === 'Y') {
					handleMerge();
				} else if (input === 'n' || input === 'N' || key.escape) {
					if (onCancel) {
						onCancel();
					} else {
						exit();
					}
				}
			} else if (status === 'conflict' || status === 'success' || status === 'error') {
				// Any key to exit after final status
				if (onCancel) {
					onCancel();
				} else {
					exit();
				}
			}
		},
		{ isActive: true }
	);

	async function handleBranchSelected() {
		// Use selected branch from list, or create new if input doesn't match
		let selectedBranch: string;

		if (filteredBranches.length > 0 && filteredBranches[selectedBranchIndex]) {
			selectedBranch = filteredBranches[selectedBranchIndex];
		} else if (branchInput.trim()) {
			// User typed a new branch name
			selectedBranch = branchInput.trim();
		} else {
			setErrorMessage('Please enter a branch name');
			setStatus('error');
			return;
		}

		setTargetBranch(selectedBranch);

		try {
			// Get diff statistics against target branch
			const stats = await getDiffStats(task, selectedBranch);
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
				setErrorMessage(`Failed to get diff stats: ${String(error)}`);
			}
			setStatus('error');
		}
	}

	async function handleMerge() {
		setStatus('merging');

		try {
			// Attempt merge
			const result = await mergeBranch(task, targetBranch);

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

	// Render branch selection
	if (status === 'selectBranch') {
		return (
			<Box flexDirection="column">
				<Box borderStyle="single" borderColor="cyan">
					<Text bold> 🐝 HIVE ─ Merge Task </Text>
				</Box>

				<Box flexDirection="column" paddingX={2} paddingY={1}>
					<Box marginBottom={1}>
						<Text bold>Task: </Text>
						<Text color="cyan">{task}</Text>
					</Box>
					<Box marginBottom={1}>
						<Text dimColor>{taskDescription}</Text>
					</Box>

					<Box marginBottom={1}>
						<Text bold>Select target branch to merge into:</Text>
					</Box>

					<Box marginBottom={1}>
						<Text>Branch: </Text>
						<TextInput
							value={branchInput}
							onChange={(value) => {
								setBranchInput(value);
								setSelectedBranchIndex(0);
							}}
							onSubmit={handleBranchSelected}
						/>
					</Box>

					{filteredBranches.length > 0 && (
						<Box flexDirection="column" marginBottom={1} marginLeft={2}>
							{filteredBranches.slice(0, 10).map((branch, index) => (
								<Text key={branch} color={index === selectedBranchIndex ? 'cyan' : 'gray'}>
									{index === selectedBranchIndex ? '► ' : '  '}
									{branch}
								</Text>
							))}
							{filteredBranches.length > 10 && (
								<Text dimColor>  ... and {filteredBranches.length - 10} more</Text>
							)}
						</Box>
					)}

					{filteredBranches.length === 0 && branchInput && (
						<Box marginBottom={1} marginLeft={2}>
							<Text color="yellow">New branch will be created: {branchInput}</Text>
						</Box>
					)}

					<Box marginTop={1}>
						<Text dimColor>↑↓:navigate  enter:select  esc:back</Text>
					</Box>
				</Box>

				<Box borderStyle="single" borderColor="cyan">
					<Text> </Text>
				</Box>
			</Box>
		);
	}

	// Render confirmation prompt
	if (status === 'confirming' && diffStats) {
		const branchExists = allBranches.includes(targetBranch);
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
						<Text color="magenta">{targetBranch}</Text>
						{!branchExists && <Text color="yellow"> (new)</Text>}
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
					<Text color="magenta">{targetBranch}</Text>
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
