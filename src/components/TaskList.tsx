import React from 'react';
import { Box, Text } from 'ink';
import { TaskRow, Task } from './TaskRow.js';

interface TaskListProps {
  tasks: Task[];
  selectedIndex: number;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, selectedIndex }) => {
  if (tasks.length === 0) {
    return (
      <Box marginY={1} justifyContent="center">
        <Text dimColor>No active tasks found. Run 'hive start' to create a new task.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {tasks.map((task, index) => (
        <TaskRow key={task.id} task={task} isSelected={index === selectedIndex} />
      ))}
    </Box>
  );
};
