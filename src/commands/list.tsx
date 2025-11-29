import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import { getTasks, Task } from '../lib/tasks.js';
import { getBranchChanges } from '../lib/git.js';
import { formatTimeAgo } from '../lib/utils.js';

interface TaskWithStats extends Task {
	filesChanged: number;
	timeAgo: string;
}

type Status = 'loading' | 'success' | 'error';

export default function List() {
	const [status, setStatus] = useState<Status>('loading');
	const [tasks, setTasks] = useState<TaskWithStats[]>([]);
	const [error, setError] = useState<string>('');

	useEffect(() => {
		const loadTasks = async () => {
			try {
				const allTasks = await getTasks();

				// Filter only active tasks
				const activeTasks = allTasks.filter((t) => t.status === 'active');

				if (activeTasks.length === 0) {
					setTasks([]);
					setStatus('success');
					return;
				}

				// Enrich tasks with stats
				const enrichedTasks: TaskWithStats[] = await Promise.all(
					activeTasks.map(async (task) => {
						try {
							const changes = await getBranchChanges(task.slug);
							const filesChanged = changes.all.length;
							const timeAgo = formatTimeAgo(task.createdAt);

							return {
								...task,
								filesChanged,
								timeAgo,
							};
						} catch (err) {
							// If we can't get stats, just use defaults
							return {
								...task,
								filesChanged: 0,
								timeAgo: formatTimeAgo(task.createdAt),
							};
						}
					})
				);

				setTasks(enrichedTasks);
				setStatus('success');
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error occurred';
				setError(errorMessage);
				setStatus('error');
			}
		};

		loadTasks();
	}, []);

	if (status === 'loading') {
		return (
			<Box>
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
				<Text> Loading tasks...</Text>
			</Box>
		);
	}

	if (status === 'error') {
		return (
			<Box>
				<Text color="red">Error: {error}</Text>
			</Box>
		);
	}

	if (tasks.length === 0) {
		return (
			<Box flexDirection="column">
				<Text color="yellow">No active tasks found.</Text>
				<Text color="dim">Create a new task with: hive new "description"</Text>
			</Box>
		);
	}

	// Calculate column widths based on content
	const slugWidth = Math.max(
		...tasks.map((t) => t.slug.length),
		'SLUG'.length
	);
	const descWidth = Math.max(
		...tasks.map((t) => t.description.length),
		'DESCRIPTION'.length,
		40
	);
	const filesWidth = 'FILES'.length + 2;
	const timeWidth = Math.max(
		...tasks.map((t) => t.timeAgo.length),
		'CREATED'.length
	);

	return (
		<Box flexDirection="column">
			{/* Header */}
			<Box>
				<Box width={slugWidth + 2}>
					<Text bold color="cyan">
						SLUG
					</Text>
				</Box>
				<Box width={descWidth + 2}>
					<Text bold color="cyan">
						DESCRIPTION
					</Text>
				</Box>
				<Box width={filesWidth + 2}>
					<Text bold color="cyan">
						FILES
					</Text>
				</Box>
				<Box width={timeWidth + 2}>
					<Text bold color="cyan">
						CREATED
					</Text>
				</Box>
			</Box>

			{/* Separator */}
			<Box>
				<Text color="gray">
					{'-'.repeat(slugWidth + descWidth + filesWidth + timeWidth + 8)}
				</Text>
			</Box>

			{/* Task rows */}
			{tasks.map((task) => (
				<Box key={task.slug}>
					<Box width={slugWidth + 2}>
						<Text color="magenta">{task.slug}</Text>
					</Box>
					<Box width={descWidth + 2}>
						<Text>
							{task.description.length > descWidth
								? task.description.substring(0, descWidth - 3) + '...'
								: task.description}
						</Text>
					</Box>
					<Box width={filesWidth + 2}>
						<Text color={task.filesChanged > 0 ? 'yellow' : 'gray'}>
							{task.filesChanged}
						</Text>
					</Box>
					<Box width={timeWidth + 2}>
						<Text color="dim">{task.timeAgo}</Text>
					</Box>
				</Box>
			))}

			{/* Footer */}
			<Box marginTop={1}>
				<Text color="dim">
					Total: {tasks.length} active {tasks.length === 1 ? 'task' : 'tasks'}
				</Text>
			</Box>
		</Box>
	);
}
