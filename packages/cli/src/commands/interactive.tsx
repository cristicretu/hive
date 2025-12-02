import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { getTasks, addTask, Task } from '../lib/tasks.js';
import { createWorktree, getDiffStats, hasUncommittedChanges } from '../lib/git.js';
import { getConfig } from '../lib/config.js';
import { generateSlug } from '../lib/utils.js';
import { formatDistanceToNow } from 'date-fns';
import * as pathModule from 'path';
import { openInEditor, EditorType } from '../lib/editor.js';
import MergeCommand from './merge.js';
import SyncCommand from './sync.js';

interface InteractiveProps {
  path?: string;
}

type Mode = 'view' | 'create' | 'settings' | 'merge' | 'confirmCommit' | 'sync';

interface TaskWithStatus extends Task {
  gitStatus?: {
    files: number;
    insertions: number;
    deletions: number;
  };
}

export default function Interactive({ path }: InteractiveProps) {
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [mode, setMode] = useState<Mode>('view');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null);
  const [taskToMerge, setTaskToMerge] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const { exit } = useApp();

  // Auto-clear error after 3 seconds
  const showError = (msg: string) => {
    setError(msg);
    if (errorTimeout) clearTimeout(errorTimeout);
    const timeout = setTimeout(() => setError(''), 3000);
    setErrorTimeout(timeout);
  };

  // Change directory if path is specified
  useEffect(() => {
    if (path) {
      try {
        const targetPath = pathModule.resolve(path);
        process.chdir(targetPath);
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to change directory');
      }
    }
  }, [path]);

  // Load tasks immediately, then fetch git status in background
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const allTasks = await getTasks();
        const activeTasks = allTasks.filter(t => t.status === 'active');

        setTasks(activeTasks);
        setLoading(false);

        const tasksWithStatus = await Promise.all(
          activeTasks.map(async (task) => {
            try {
              const diffStats = await getDiffStats(task.slug);
              return {
                ...task,
                gitStatus: {
                  files: diffStats.totalFiles,
                  insertions: diffStats.totalInsertions,
                  deletions: diffStats.totalDeletions,
                },
              };
            } catch {
              return task;
            }
          })
        );

        // Update with status
        setTasks(tasksWithStatus);
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to load tasks');
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  // Keyboard navigation
  useInput((input, key) => {
    if (mode === 'create') {
      if (key.escape) {
        setMode('view');
        setNewTaskInput('');
      }
      return;
    }

    if (mode === 'settings') {
      if (key.escape) {
        setMode('view');
      }
      return;
    }

    if (mode === 'confirmCommit') {
      if (key.escape) {
        setMode('view');
        setCommitMessage('');
        setTaskToMerge(null);
      }
      return;
    }

    if (mode === 'merge') {
      return;
    }

    if (mode === 'sync') {
      if (key.escape) {
        setMode('view');
      }
      return;
    }

    // View mode controls
    if (input === 'n') {
      setMode('create');
    } else if (input === 's') {
      setMode('settings');
    } else if (input === 'r') {
      // Trigger sync/review
      setMode('sync');
    } else if (input === 'q' || key.escape) {
      exit();
    } else if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(tasks.length - 1, selectedIndex + 1));
    } else if ((input === 'm' || input === 'x') && tasks.length > 0) {
      // Merge the selected task
      handleMergeTask(tasks[selectedIndex]);
    } else if (input === 'd' && tasks.length > 0) {
      // Drop task
      handleDropTask(tasks[selectedIndex]);
    } else if (input === 'o' && tasks.length > 0) {
      // Open selected task in editor
      handleOpenTask(tasks[selectedIndex]);
    } else if (input === 'c' && tasks.length > 0) {
      // Open in Cursor
      handleOpenTask(tasks[selectedIndex], 'cursor');
    } else if (input === 'a' && tasks.length > 0) {
      // Open with Claude
      handleOpenTask(tasks[selectedIndex], 'claude');
    }
  });

  const handleMergeTask = async (task: Task) => {
    try {
      // Check for uncommitted changes first
      const hasChanges = await hasUncommittedChanges(task.slug);
      if (hasChanges) {
        // Prompt to commit changes
        setTaskToMerge(task.slug);
        setCommitMessage(`wip: ${task.description}`);
        setMode('confirmCommit');
        return;
      }

      setTaskToMerge(task.slug);
      setMode('merge');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to check task status');
    }
  };

  const handleCommitAndMerge = async () => {
    if (!taskToMerge) return;

    try {
      const task = tasks.find(t => t.slug === taskToMerge);
      if (!task) return;

      // Run git commands in the worktree
      const { execSync } = await import('child_process');
      const worktreePath = task.worktreePath;

      // Add all changes and commit
      execSync('git add -A', { cwd: worktreePath });
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: worktreePath });

      // Now proceed to merge
      setMode('merge');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to commit changes');
      setMode('view');
      setTaskToMerge(null);
      setCommitMessage('');
    }
  };

  const handleOpenTask = (task: Task, editor?: EditorType) => {
    try {
      const config = getConfig();
      const editorToUse = editor || config.defaultEditor;
      openInEditor(task.worktreePath, editorToUse);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to open editor');
    }
  };

  const handleDropTask = async (task: Task) => {
    try {
      const { removeWorktree } = await import('../lib/git.js');
      const { removeTask } = await import('../lib/tasks.js');

      await removeWorktree(task.slug);
      await removeTask(task.slug);

      setTasks(tasks.filter(t => t.slug !== task.slug));

      if (selectedIndex >= tasks.length - 1) {
        setSelectedIndex(Math.max(0, tasks.length - 2));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to drop task');
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskInput.trim()) return;

    try {
      const slug = generateSlug(newTaskInput);
      const config = getConfig();
      const result = await createWorktree(slug, config.defaultBaseBranch);

      const task: Task = {
        slug,
        description: newTaskInput,
        branch: `hive/${slug}`,
        worktreePath: result.path,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      await addTask(task);
      setTasks([...tasks, task]);
      setNewTaskInput('');
      setMode('view');

      // Show symlink info if any were created
      if (result.symlinks.created.length > 0) {
        const { formatBytes } = await import('../lib/symlinks.js');
        showError(`✓ Task created (saved ${formatBytes(result.symlinks.savedBytes)} via symlinks: ${result.symlinks.created.join(', ')})`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  if (loading) {
    return <Text>Loading...</Text>;
  }

  const repoName = path ? path.split('/').pop() : 'current directory';

  // Commit confirmation view
  if (mode === 'confirmCommit' && taskToMerge) {
    const task = tasks.find(t => t.slug === taskToMerge);
    if (!task) return null;

    return (
      <Box flexDirection="column">
        <Box borderStyle="single" borderColor="cyan">
          <Text bold> 🐝 HIVE ─ Commit Changes </Text>
        </Box>

        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Box marginBottom={1}>
            <Text bold>Task: </Text>
            <Text color="cyan">{task.slug}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor>{task.description}</Text>
          </Box>

          <Box marginBottom={1}>
            <Text color="yellow">⚠ Task has uncommitted changes</Text>
          </Box>

          <Box marginBottom={1}>
            <Text>Commit message: </Text>
            <TextInput
              value={commitMessage}
              onChange={setCommitMessage}
              onSubmit={handleCommitAndMerge}
            />
          </Box>

          <Box marginTop={1}>
            <Text dimColor>enter:commit and merge  esc:cancel</Text>
          </Box>
        </Box>

        <Box borderStyle="single" borderColor="cyan">
          <Text> </Text>
        </Box>
      </Box>
    );
  }

  // Merge view
  if (mode === 'merge' && taskToMerge) {
    return <MergeCommand
      task={taskToMerge}
      noDelete={false}
      onCancel={async () => {
        // Return to view mode and reload tasks
        setMode('view');
        setTaskToMerge(null);

        // Reload tasks to refresh the list
        try {
          const allTasks = await getTasks();
          const activeTasks = allTasks.filter(t => t.status === 'active');
          setTasks(activeTasks);

          // Adjust selected index if needed
          if (selectedIndex >= activeTasks.length) {
            setSelectedIndex(Math.max(0, activeTasks.length - 1));
          }
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Failed to reload tasks');
        }
      }}
    />;
  }

  // Sync/Review view
  if (mode === 'sync') {
    return (
      <Box flexDirection="column">
        <SyncCommand path={path} />
        <Box marginTop={1} borderStyle="single" borderColor="cyan" paddingX={2}>
          <Text dimColor>Press ESC to return to task list</Text>
        </Box>
      </Box>
    );
  }

  // Settings view
  if (mode === 'settings') {
    const config = getConfig();
    return (
      <Box flexDirection="column">
        <Box borderStyle="single" borderColor="cyan">
          <Text bold> 🐝 HIVE ─ Settings </Text>
        </Box>
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text dimColor>Default editor: <Text color="cyan">{config.defaultEditor}</Text></Text>
          <Text dimColor>Worktree location: <Text color="cyan">{config.worktreeDir}</Text></Text>
          <Box marginTop={1}>
            <Text dimColor>esc:back</Text>
          </Box>
        </Box>
        <Box borderStyle="single" borderColor="cyan">
          <Text> </Text>
        </Box>
      </Box>
    );
  }

  // Create task view
  if (mode === 'create') {
    return (
      <Box flexDirection="column">
        <Box borderStyle="single" borderColor="cyan">
          <Text bold> 🐝 HIVE ─ New Task </Text>
        </Box>
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Box>
            <Text>Description: </Text>
            <TextInput
              value={newTaskInput}
              onChange={setNewTaskInput}
              onSubmit={handleCreateTask}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>enter:create  esc:cancel</Text>
          </Box>
        </Box>
        <Box borderStyle="single" borderColor="cyan">
          <Text> </Text>
        </Box>
      </Box>
    );
  }

  // Main task list view
  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="cyan">
        <Text bold> 🐝 HIVE </Text>
      </Box>

      {error && (
        <Box paddingX={2}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      )}

      <Box paddingX={2} paddingY={1} flexDirection="column">
        <Text dimColor>{repoName}</Text>
        <Text> </Text>

        {tasks.length === 0 ? (
          <Text dimColor>no tasks · press n to create</Text>
        ) : (
          tasks.map((task, index) => {
            const isSelected = index === selectedIndex;

            // Format time concisely
            const now = new Date();
            const created = new Date(task.createdAt);
            const diffMs = now.getTime() - created.getTime();
            const minutes = Math.floor(diffMs / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            let timeStr;
            if (days > 0) timeStr = `${days}d`;
            else if (hours > 0) timeStr = `${hours}h`;
            else timeStr = `${minutes}m`;

            const statusIcon = task.gitStatus && task.gitStatus.files > 0 ? '●' : '✓';
            const statusColor = task.gitStatus && task.gitStatus.files > 0 ? 'yellow' : 'green';
            const stats = task.gitStatus && task.gitStatus.files > 0
              ? `+${task.gitStatus.insertions}-${task.gitStatus.deletions}`
              : 'clean';

            return (
              <Box key={task.slug}>
                <Text color={isSelected ? 'cyan' : 'white'}>{isSelected ? '► ' : '  '}</Text>
                <Text color={isSelected ? 'cyan' : 'white'}>{task.slug.padEnd(20)}</Text>
                <Text dimColor>  {timeStr.padEnd(5)}</Text>
                <Text dimColor>  {stats.padEnd(12)}</Text>
                <Text color={statusColor}>{statusIcon}</Text>
              </Box>
            );
          })
        )}
      </Box>

      <Box borderStyle="single" borderColor="cyan">
        <Text dimColor> n:new r:review o:open c:cursor a:claude m:merge d:drop s:settings q:quit </Text>
      </Box>
    </Box>
  );
}
