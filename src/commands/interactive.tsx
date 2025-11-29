import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { getTasks, addTask, Task } from '../lib/tasks.js';
import { createWorktree } from '../lib/git.js';
import { getConfig } from '../lib/config.js';
import { generateSlug } from '../lib/utils.js';
import { formatDistanceToNow } from 'date-fns';
import * as pathModule from 'path';

interface InteractiveProps {
  path?: string;
}

type Mode = 'view' | 'create';

export default function Interactive({ path }: InteractiveProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<Mode>('view');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { exit } = useApp();

  // Change directory if path is specified
  useEffect(() => {
    if (path) {
      try {
        const targetPath = pathModule.resolve(path);
        process.chdir(targetPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to change directory');
      }
    }
  }, [path]);

  // Load tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const allTasks = await getTasks();
        setTasks(allTasks.filter(t => t.status === 'active'));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        setLoading(false);
      }
    };

    loadTasks();
    const interval = setInterval(loadTasks, 2000);
    return () => clearInterval(interval);
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

    // View mode controls
    if (input === 'n') {
      setMode('create');
    } else if (input === 'q' || key.escape) {
      exit();
    } else if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(tasks.length - 1, selectedIndex + 1));
    } else if ((key.return || input === ' ' || input === 'x') && tasks.length > 0) {
      // Complete/archive the selected task
      handleCompleteTask(tasks[selectedIndex]);
    }
  });

  const handleCompleteTask = async (task: Task) => {
    try {
      const { updateTask } = await import('../lib/tasks.js');
      await updateTask(task.slug, { status: 'merged' });

      // Remove from local state
      setTasks(tasks.filter(t => t.slug !== task.slug));

      // Adjust selected index if needed
      if (selectedIndex >= tasks.length - 1) {
        setSelectedIndex(Math.max(0, tasks.length - 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskInput.trim()) return;

    try {
      const slug = generateSlug(newTaskInput);
      const config = getConfig();
      const worktreePath = await createWorktree(slug, config.defaultBaseBranch);

      const task: Task = {
        slug,
        description: newTaskInput,
        branch: `hive/${slug}`,
        worktreePath,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      await addTask(task);
      setTasks([...tasks, task]);
      setNewTaskInput('');
      setMode('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  if (loading) {
    return (
      <Box>
        <Text>Loading tasks...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press q to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} borderStyle="round" borderColor="cyan" paddingX={2}>
        <Text bold color="cyan">
          🐝 HIVE - Interactive Mode
        </Text>
      </Box>

      {path && (
        <Box marginBottom={1}>
          <Text dimColor>Working directory: {path}</Text>
        </Box>
      )}

      {/* Tasks List */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <Text bold>Active Tasks ({tasks.length})</Text>
        </Box>

        {tasks.length === 0 ? (
          <Box>
            <Text dimColor>No active tasks. Press 'n' to create a new one.</Text>
          </Box>
        ) : (
          tasks.map((task, index) => {
            const isSelected = index === selectedIndex;
            const timeAgo = formatDistanceToNow(new Date(task.createdAt), { addSuffix: true });

            return (
              <Box key={task.slug} marginY={0}>
                <Text color={isSelected ? 'cyan' : 'white'}>
                  {isSelected ? '▶ ' : '  '}
                </Text>
                <Text color={isSelected ? 'cyan' : 'gray'}>[ ] </Text>
                <Box flexDirection="column">
                  <Box>
                    <Text bold={isSelected} color={isSelected ? 'cyan' : 'white'}>
                      {task.slug}
                    </Text>
                    <Text dimColor> · {timeAgo}</Text>
                  </Box>
                  <Box marginLeft={4}>
                    <Text dimColor>{task.description}</Text>
                  </Box>
                  <Box marginLeft={4}>
                    <Text dimColor>{task.worktreePath}</Text>
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {/* Input mode */}
      {mode === 'create' && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
          <Box marginBottom={1}>
            <Text color="yellow">Create New Task</Text>
          </Box>
          <Box>
            <Text>Description: </Text>
            <TextInput
              value={newTaskInput}
              onChange={setNewTaskInput}
              onSubmit={handleCreateTask}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to create, Esc to cancel</Text>
          </Box>
        </Box>
      )}

      {/* Footer / Keyboard shortcuts */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
        <Text dimColor>
          [n] New  [↑↓/jk] Navigate  [x/space/enter] Complete  [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
