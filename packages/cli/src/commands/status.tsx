import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import simpleGit, { SimpleGit } from 'simple-git';
import { Header } from '../components/Header.js';
import { TaskList } from '../components/TaskList.js';
import { KeyboardHints } from '../components/KeyboardHints.js';
import { Task, TaskStatus } from '../components/TaskRow.js';
import chalk from 'chalk';

interface StatusProps {
  cwd?: string;
}

export default function Status({ cwd = process.cwd() }: StatusProps) {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch git status and worktree information
  const fetchTasks = async () => {
    try {
      const git: SimpleGit = simpleGit(cwd);

      // Check if we're in a git repository
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        setError('Not a git repository');
        setLoading(false);
        return;
      }

      // Get list of worktrees
      const worktrees = await git.raw(['worktree', 'list', '--porcelain']);
      const worktreeLines = worktrees.split('\n');

      const parsedTasks: Task[] = [];
      let currentWorktree: any = {};

      for (const line of worktreeLines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            parsedTasks.push(await parseWorktreeToTask(currentWorktree));
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.head = line.substring(5);
        } else if (line.startsWith('detached')) {
          currentWorktree.detached = true;
        }
      }

      // Add the last worktree
      if (currentWorktree.path) {
        parsedTasks.push(await parseWorktreeToTask(currentWorktree));
      }

      setTasks(parsedTasks);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setLoading(false);
    }
  };

  // Parse worktree info into Task object
  const parseWorktreeToTask = async (worktree: any): Promise<Task> => {
    const git: SimpleGit = simpleGit(worktree.path);

    try {
      // Get status
      const status = await git.status();
      const isDirty = status.files.length > 0;

      // Get diff stats
      let diffStats = { filesChanged: 0, insertions: 0, deletions: 0 };
      try {
        const diffSummary = await git.diffSummary(['HEAD']);
        diffStats = {
          filesChanged: diffSummary.files.length,
          insertions: diffSummary.insertions,
          deletions: diffSummary.deletions,
        };
      } catch {
        // Might fail on initial commit or detached HEAD
      }

      // Determine status
      let taskStatus: TaskStatus = 'completed';
      if (isDirty) {
        taskStatus = 'running';
      } else if (diffStats.filesChanged === 0) {
        taskStatus = 'pending';
      }

      // Get branch description (could be from branch description or commit message)
      let description = 'No description';
      try {
        const branchName = worktree.branch || 'HEAD';
        const branchDesc = await git.raw(['config', `branch.${branchName}.description`]);
        if (branchDesc.trim()) {
          description = branchDesc.trim();
        } else {
          // Fallback to latest commit message
          const log = await git.log({ maxCount: 1 });
          if (log.latest) {
            description = log.latest.message;
          }
        }
      } catch {
        // Use fallback description
      }

      return {
        id: worktree.path,
        branch: worktree.branch || 'HEAD',
        description,
        status: taskStatus,
        filesChanged: diffStats.filesChanged,
        insertions: diffStats.insertions,
        deletions: diffStats.deletions,
      };
    } catch (err) {
      // Return basic task info on error
      return {
        id: worktree.path,
        branch: worktree.branch || 'HEAD',
        description: 'Error loading task details',
        status: 'failed',
      };
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, []);

  // Poll every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTasks();
    }, 2000);

    return () => clearInterval(interval);
  }, [cwd]);

  // Keyboard navigation
  useInput((input, key) => {
    // Clear any messages on new input
    if (message) {
      setMessage(null);
    }

    // Navigation
    if (input === 'j' || key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, tasks.length - 1));
    } else if (input === 'k' || key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
    // Actions
    else if (input === 'q') {
      exit();
    } else if (input === 'o') {
      handleOpenTask();
    } else if (input === 'd') {
      handleShowDiff();
    } else if (input === 'm') {
      handleMergeTask();
    } else if (input === 'x') {
      handleDropTask();
    }
  });

  // Action handlers
  const handleOpenTask = () => {
    if (tasks[selectedIndex]) {
      setMessage(chalk.cyan(`Opening task: ${tasks[selectedIndex].branch}`));
      // In a real implementation, this would switch to the worktree
      // For now, just show a message
    }
  };

  const handleShowDiff = () => {
    if (tasks[selectedIndex]) {
      setMessage(chalk.blue(`Showing diff for: ${tasks[selectedIndex].branch}`));
      // In a real implementation, this would show git diff
    }
  };

  const handleMergeTask = () => {
    if (tasks[selectedIndex]) {
      setMessage(chalk.green(`Merging task: ${tasks[selectedIndex].branch}`));
      // In a real implementation, this would merge the branch
    }
  };

  const handleDropTask = () => {
    if (tasks[selectedIndex]) {
      setMessage(chalk.red(`Dropping task: ${tasks[selectedIndex].branch}`));
      // In a real implementation, this would remove the worktree
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Box flexDirection="column">
        <Header />
        <Box justifyContent="center" marginY={2}>
          <Text>Loading tasks...</Text>
        </Box>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box flexDirection="column">
        <Header />
        <Box justifyContent="center" marginY={2}>
          <Text color="red">Error: {error}</Text>
        </Box>
        <Box justifyContent="center">
          <Text dimColor>Press 'q' to quit</Text>
        </Box>
      </Box>
    );
  }

  // Render main UI
  return (
    <Box flexDirection="column">
      <Header />

      {message && (
        <Box marginY={1} justifyContent="center">
          <Text>{message}</Text>
        </Box>
      )}

      <Box borderStyle="round" borderColor="gray" flexDirection="column" paddingX={1}>
        <Box marginBottom={0.5}>
          <Text bold>Active Tasks ({tasks.length})</Text>
          <Text dimColor> - Auto-refreshing every 2s</Text>
        </Box>
        <TaskList tasks={tasks} selectedIndex={selectedIndex} />
      </Box>

      <KeyboardHints />
    </Box>
  );
}
