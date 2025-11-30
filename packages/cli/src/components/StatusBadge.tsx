import React from 'react';
import { Text } from 'ink';
import chalk from 'chalk';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

interface StatusBadgeProps {
  status: TaskStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return { symbol: '●', color: chalk.gray, label: 'PENDING' };
      case 'running':
        return { symbol: '◐', color: chalk.yellow, label: 'RUNNING' };
      case 'completed':
        return { symbol: '✓', color: chalk.green, label: 'DONE' };
      case 'failed':
        return { symbol: '✗', color: chalk.red, label: 'FAILED' };
      default:
        return { symbol: '●', color: chalk.gray, label: 'UNKNOWN' };
    }
  };

  const { symbol, color, label } = getStatusDisplay();

  return (
    <Text color={color.hex}>
      {symbol} {label}
    </Text>
  );
};
