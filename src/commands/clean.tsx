import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { getTasks, Task, removeTask } from '../lib/tasks.js';
import { removeWorktree } from '../lib/git.js';
import { getConfig } from '../lib/config.js';
import { formatDistanceToNow } from 'date-fns';
import { execSync } from 'child_process';
import fs from 'fs';

export interface CleanProps {
	stale?: string; // e.g., "7d", "14d"
	force?: boolean;
	dryRun?: boolean;
}

type Status = 'loading' | 'confirming' | 'cleaning' | 'done';

interface StaleTask extends Task {
	lastActivity: Date;
}

/**
 * Clean Command
 * Remove stale or old worktrees
 */
export default function CleanCommand({ stale = '7d', force = false, dryRun = false }: CleanProps) {
	const { exit } = useApp();
	const [status, setStatus] = useState<Status>('loading');
	const [staleTasks, setStaleTasks] = useState<StaleTask[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [cleanedCount, setCleanedCount] = useState(0);

	useEffect(() => {
		async function findStaleTasks() {
			const tasks = await getTasks();
			const activeTasks = tasks.filter(t => t.status === 'active');
			const staleMs = parseStaleTime(stale);
			const now = Date.now();

			const stale: StaleTask[] = [];

			for (const task of activeTasks) {
				const lastActivity = await getLastActivityTime(task.worktreePath);
				if (now - lastActivity.getTime() > staleMs) {
					stale.push({ ...task, lastActivity });
				}
			}

			setStaleTasks(stale);

			if (stale.length === 0) {
				setStatus('done');
			} else if (force || dryRun) {
				if (dryRun) {
					setStatus('done');
				} else {
					setStatus('cleaning');
					cleanAllTasks(stale);
				}
			} else {
				setStatus('confirming');
			}
		}

		findStaleTasks();
	}, [stale, force, dryRun]);

	async function cleanAllTasks(tasks: StaleTask[]) {
		for (const task of tasks) {
			try {
				await removeWorktree(task.slug);
				await removeTask(task.slug);
				setCleanedCount(prev => prev + 1);
			} catch (error) {
				// Continue on error
			}
		}
		setStatus('done');
	}

	async function cleanCurrentTask() {
		const task = staleTasks[currentIndex];
		try {
			await removeWorktree(task.slug);
			await removeTask(task.slug);
			setCleanedCount(prev => prev + 1);
		} catch (error) {
			// Continue on error
		}

		// Move to next task
		if (currentIndex >= staleTasks.length - 1) {
			setStatus('done');
		} else {
			setCurrentIndex(prev => prev + 1);
		}
	}

	function skipCurrentTask() {
		if (currentIndex >= staleTasks.length - 1) {
			setStatus('done');
		} else {
			setCurrentIndex(prev => prev + 1);
		}
	}

	// Handle user input for confirmation
	useInput(
		(input, key) => {
			if (status === 'confirming') {
				if (input === 'y' || input === 'Y') {
					cleanCurrentTask();
				} else if (input === 'n' || input === 'N') {
					skipCurrentTask();
				} else if (key.escape) {
					exit();
				}
			} else if (status === 'done') {
				exit();
			}
		},
		{ isActive: true }
	);

	// Loading state
	if (status === 'loading') {
		return (
			<Box>
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
				<Text> Finding stale tasks...</Text>
			</Box>
		);
	}

	// No stale tasks found
	if (status === 'done' && staleTasks.length === 0) {
		return (
			<Box flexDirection="column">
				<Text color="green">✓ No stale tasks found</Text>
				<Box marginTop={1}>
					<Text dimColor>All tasks have been active within {stale}.</Text>
				</Box>
			</Box>
		);
	}

	// Dry run results
	if (dryRun && status === 'done') {
		return (
			<Box flexDirection="column">
				<Text color="yellow">Dry run - would remove {staleTasks.length} stale tasks:</Text>
				<Box marginTop={1} flexDirection="column">
					{staleTasks.map(task => (
						<Text key={task.slug} dimColor>
							  {task.slug} (inactive {formatDistanceToNow(task.lastActivity, { addSuffix: true })})
						</Text>
					))}
				</Box>
				<Box marginTop={1}>
					<Text dimColor>Run without --dry-run to remove these tasks.</Text>
				</Box>
			</Box>
		);
	}

	// Cleaning in progress (force mode)
	if (status === 'cleaning') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text> Cleaning {cleanedCount + 1}/{staleTasks.length} tasks...</Text>
				</Box>
			</Box>
		);
	}

	// Done cleaning
	if (status === 'done') {
		return (
			<Box flexDirection="column">
				<Text color="green">✓ Cleaned {cleanedCount} stale task(s)</Text>
				{cleanedCount < staleTasks.length && (
					<Text dimColor>Skipped {staleTasks.length - cleanedCount} task(s)</Text>
				)}
			</Box>
		);
	}

	// Confirmation mode (interactive)
	const currentTask = staleTasks[currentIndex];
	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text bold>Remove stale task? ({currentIndex + 1}/{staleTasks.length})</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color="cyan" bold>
					{currentTask.slug}
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>{currentTask.description}</Text>
			</Box>

			<Box marginBottom={1}>
				<Text color="yellow">
					Last activity: {formatDistanceToNow(currentTask.lastActivity, { addSuffix: true })}
				</Text>
			</Box>

			<Box marginTop={1}>
				<Text>
					<Text color="green">[y]</Text>es  <Text color="red">[n]</Text>o  <Text dimColor>esc:cancel</Text>
				</Text>
			</Box>
		</Box>
	);
}

/**
 * Parse stale time string to milliseconds
 */
function parseStaleTime(str: string): number {
	const match = str.match(/^(\d+)(d|h|m)$/);
	if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

	const num = parseInt(match[1]);
	const unit = match[2];

	switch (unit) {
		case 'd':
			return num * 24 * 60 * 60 * 1000;
		case 'h':
			return num * 60 * 60 * 1000;
		case 'm':
			return num * 60 * 1000;
		default:
			return 7 * 24 * 60 * 60 * 1000;
	}
}

/**
 * Get last activity time for a worktree
 */
async function getLastActivityTime(worktreePath: string): Promise<Date> {
	try {
		// Check git log for last commit time
		const output = execSync(`git -C "${worktreePath}" log -1 --format=%ct 2>/dev/null`, {
			encoding: 'utf8',
		});
		const timestamp = parseInt(output.trim()) * 1000;
		return new Date(timestamp);
	} catch {
		// Fallback to directory mtime
		try {
			const stats = fs.statSync(worktreePath);
			return new Date(stats.mtimeMs);
		} catch {
			// If directory doesn't exist, return epoch
			return new Date(0);
		}
	}
}
