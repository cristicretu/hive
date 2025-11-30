import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import { createWorktree } from '../lib/git.js';
import { addTask, Task } from '../lib/tasks.js';
import { getConfig } from '../lib/config.js';
import { openInEditor } from '../lib/editor.js';
import { generateSlug } from '../lib/utils.js';
import { formatBytes } from '../lib/symlinks.js';

export interface NewProps {
	description: string;
	open?: boolean;
}

type Status = 'creating' | 'success' | 'error';

export default function New({ description, open = false }: NewProps) {
	const [status, setStatus] = useState<Status>('creating');
	const [error, setError] = useState<string>('');
	const [slug, setSlug] = useState<string>('');
	const [worktreePath, setWorktreePath] = useState<string>('');
	const [symlinkInfo, setSymlinkInfo] = useState<string>('');

	useEffect(() => {
		const createTask = async () => {
			try {
				// Generate slug from description
				const taskSlug = generateSlug(description);
				setSlug(taskSlug);

				// Get config for base branch
				const config = getConfig();

				// Create worktree using git.ts functions
				const result = await createWorktree(taskSlug, config.defaultBaseBranch);
				setWorktreePath(result.path);

				// Save symlink info for display
				if (result.symlinks.created.length > 0) {
					setSymlinkInfo(
						`Saved ${formatBytes(result.symlinks.savedBytes)} via symlinks: ${result.symlinks.created.join(', ')}`
					);
				}

				// Add task to tasks.json
				const task: Task = {
					slug: taskSlug,
					description,
					branch: `hive/${taskSlug}`,
					worktreePath: result.path,
					createdAt: new Date().toISOString(),
					status: 'active',
				};

				await addTask(task);

				// If --open flag, open in editor
				if (open) {
					try {
						openInEditor(path, config.defaultEditor);
					} catch (editorError) {
						// Don't fail the whole operation if editor fails
						console.error(
							chalk.yellow(
								`\nWarning: Could not open editor: ${editorError instanceof Error ? editorError.message : String(editorError)}`
							)
						);
					}
				}

				setStatus('success');
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : 'Unknown error occurred';
				setError(errorMessage);
				setStatus('error');
			}
		};

		createTask();
	}, [description, open]);

	if (status === 'creating') {
		return (
			<Box flexDirection="column">
				<Box>
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
					<Text> Creating task...</Text>
				</Box>
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
			<Text color="green">✓ Task created successfully!</Text>
			{symlinkInfo && (
				<Box marginTop={1}>
					<Text color="cyan">{symlinkInfo}</Text>
				</Box>
			)}
			<Box marginTop={1}>
				<Box width={20}>
					<Text color="gray">Slug:</Text>
				</Box>
				<Text color="cyan" bold>
					{slug}
				</Text>
			</Box>
			<Box>
				<Box width={20}>
					<Text color="gray">Description:</Text>
				</Box>
				<Text>{description}</Text>
			</Box>
			<Box>
				<Box width={20}>
					<Text color="gray">Branch:</Text>
				</Box>
				<Text color="magenta">hive/{slug}</Text>
			</Box>
			<Box>
				<Box width={20}>
					<Text color="gray">Location:</Text>
				</Box>
				<Text color="dim">{worktreePath}</Text>
			</Box>
			{open && (
				<Box marginTop={1}>
					<Text color="yellow">Opening in editor...</Text>
				</Box>
			)}
		</Box>
	);
}
