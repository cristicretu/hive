import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import chalk from 'chalk';
import { getTask } from '../lib/tasks.js';
import { getConfig } from '../lib/config.js';
import { openInEditor, EditorType } from '../lib/editor.js';

interface Props {
	task: string;
	cursor?: boolean;
	code?: boolean;
	claude?: boolean;
	terminal?: boolean;
}

/**
 * Open Command
 * Opens a task's worktree in the specified editor
 */
export default function OpenCommand({ task, cursor, code, claude, terminal }: Props) {
	const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
	const [errorMessage, setErrorMessage] = useState<string>('');
	const [openedEditor, setOpenedEditor] = useState<string>('');
	const [taskDescription, setTaskDescription] = useState<string>('');

	useEffect(() => {
		async function openTask() {
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
					setErrorMessage(`Task "${task}" is ${taskData.status}. Only active tasks can be opened.`);
					setStatus('error');
					return;
				}

				// Determine which editor to use
				let editor: EditorType | undefined;

				if (cursor) {
					editor = 'cursor';
				} else if (code) {
					editor = 'code';
				} else if (claude) {
					editor = 'claude';
				} else if (terminal) {
					editor = 'terminal';
				} else {
					// Default to configured editor
					const config = getConfig();
					editor = config.defaultEditor;
				}

				if (!editor) {
					setErrorMessage('No editor specified and no default editor configured');
					setStatus('error');
					return;
				}

				// Open in editor
				try {
					openInEditor(taskData.worktreePath, editor);
					setOpenedEditor(editor);
					setTaskDescription(taskData.description);
					setStatus('success');
				} catch (error) {
					if (error instanceof Error) {
						setErrorMessage(error.message);
					} else {
						setErrorMessage(`Failed to open editor: ${String(error)}`);
					}
					setStatus('error');
				}
			} catch (error) {
				if (error instanceof Error) {
					setErrorMessage(error.message);
				} else {
					setErrorMessage(`An unexpected error occurred: ${String(error)}`);
				}
				setStatus('error');
			}
		}

		openTask();
	}, [task, cursor, code, claude, terminal]);

	if (status === 'loading') {
		return (
			<Box flexDirection="column">
				<Text>Opening task {chalk.cyan(task)}...</Text>
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

	// Success
	const editorDisplayName = openedEditor === 'terminal'
		? 'terminal'
		: openedEditor.charAt(0).toUpperCase() + openedEditor.slice(1);

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="green" bold>Success! </Text>
				<Text>Opened task </Text>
				<Text bold>{taskDescription}</Text>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>
					Editor: {chalk.cyan(editorDisplayName)} • Task: {chalk.cyan(task)}
				</Text>
			</Box>
		</Box>
	);
}
