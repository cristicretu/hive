import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { StatusBadge, TaskStatus } from './StatusBadge.js';

export interface Task {
  id: string;
  branch: string;
  description: string;
  status: TaskStatus;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
  lastUpdated?: Date;
}

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({ task, isSelected }) => {
  const selectedIndicator = isSelected ? chalk.cyan('▶') : ' ';
  const branchName = isSelected ? chalk.cyan.bold(task.branch) : chalk.white(task.branch);

  const stats = [];
  if (task.filesChanged !== undefined) {
    stats.push(chalk.blue(`${task.filesChanged} files`));
  }
  if (task.insertions !== undefined) {
    stats.push(chalk.green(`+${task.insertions}`));
  }
  if (task.deletions !== undefined) {
    stats.push(chalk.red(`-${task.deletions}`));
  }

  const statsText = stats.length > 0 ? ` (${stats.join(', ')})` : '';

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        <Text>{selectedIndicator} </Text>
        <Box width={12}>
          <StatusBadge status={task.status} />
        </Box>
        <Text> </Text>
        <Text bold>{branchName}</Text>
      </Box>
      <Box marginLeft={3}>
        <Text dimColor>
          {task.description}
          {statsText}
        </Text>
      </Box>
    </Box>
  );
};
