import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { getTask, removeTask, updateTask } from '../lib/tasks.js';
import { removeWorktree, getWorktreeStatus } from '../lib/git.js';

export interface DropProps {
	task: string;
	force?: boolean;
}

type Status = 'checking' | 'confirming' | 'dropping' | 'success' | 'error';

export default function Drop({ task, force = false }: DropProps) {
	const [status, setStatus] = useState<Status>('checking');
	const [error, setError] = useState<string>('');
	const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
	const [filesChanged, setFilesChanged] = useState(0);
	const [confirmation, setConfirmation] = useState('');
	const [needsConfirmation, setNeedsConfirmation] = useState(false);

	useEffect(() => {
		const checkTask = async () => {
			try {
				// Find task by slug
				const taskData = await getTask(task);

				if (!taskData) {
					setError(`Task "${task}" not found`);
					setStatus('error');
					return;
				}

				// Check for uncommitted changes (unless --force)
				if (!force) {
					try {
						const worktreeStatus = await getWorktreeStatus(task);
						const hasChanges = !worktreeStatus.isClean;
						const totalFiles =
							worktreeStatus.modified +
							worktreeStatus.added +
							worktreeStatus.deleted +
							worktreeStatus.staged;

						setHasUncommittedChanges(hasChanges);
						setFilesChanged(totalFiles);

						if (hasChanges) {
							setNeedsConfirmation(true);
							setStatus('confirming');
							return;
						}
					} catch (err) {
						// If we can't check status, assume it's safe to proceed
						console.error('Warning: Could not check worktree status');
					}
				}

				// If force or no changes, proceed directly
				setStatus('dropping');
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error occurred';
				setError(errorMessage);
				setStatus('error');
			}
		};

		checkTask();
	}, [task, force]);

	// Effect to handle dropping after confirmation or immediately
	useEffect(() => {
		if (status === 'dropping') {
			const dropTask = async () => {
				try {
					// Remove worktree and delete branch
					await removeWorktree(task);

					// Remove from tasks.json
					const removed = await removeTask(task);

					if (!removed) {
						setError(`Failed to remove task from tasks.json`);
						setStatus('error');
						return;
					}

					setStatus('success');
				} catch (err) {
					const errorMessage =
						err instanceof Error ? err.message : 'Unknown error occurred';
					setError(errorMessage);
					setStatus('error');
				}
			};

			dropTask();
		}
	}, [status, task]);

	if (status === 'checking') {
		return (
			<Box>
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
				<Text> Checking task...</Text>
			</Box>
		);
	}

	if (status === 'confirming') {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text color="yellow" bold>
						Warning: Uncommitted changes detected!
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text>
						Task <Text color="magenta">{task}</Text> has{' '}
						<Text color="yellow" bold>
							{filesChanged}
						</Text>{' '}
						uncommitted {filesChanged === 1 ? 'file' : 'files'}.
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color="red">
						Dropping this task will permanently delete these changes.
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color="dim">
						Tip: Use --force to skip this confirmation in the future.
					</Text>
				</Box>
				<Box>
					<Text>Type </Text>
					<Text color="red" bold>
						{task}
					</Text>
					<Text> to confirm: </Text>
					<TextInput
						value={confirmation}
						onChange={(value) => {
							setConfirmation(value);
							if (value === task) {
								setStatus('dropping');
							}
						}}
					/>
				</Box>
			</Box>
		);
	}

	if (status === 'dropping') {
		return (
			<Box>
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
				<Text> Dropping task...</Text>
			</Box>
		);
	}

	if (status === 'error') {
		return (
			<Box flexDirection="column">
				<Text color="red">Error: {error}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" paddingTop={1}>
			<Text color="green">Task dropped successfully!</Text>
			<Box marginTop={1}>
				<Box width={20}>
					<Text color="gray">Dropped task:</Text>
				</Box>
				<Text color="magenta" bold>
					{task}
				</Text>
			</Box>
			<Box marginTop={1}>
				<Text color="dim">
					The worktree, branch, and task entry have been removed.
				</Text>
			</Box>
		</Box>
	);
}
