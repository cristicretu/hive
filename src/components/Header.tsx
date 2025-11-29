import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import chalk from 'chalk';

interface HeaderProps {
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ subtitle = 'Parallel AI Agent Workspaces' }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Gradient name="passion">
        <Text bold>
          {'  '}
          {'█'} {'█'} {'█'} {'█'} {'█'} {'█'} {'█'} {'█'} {'█'} {'█'}
          {'  '}
        </Text>
        <Text bold>
          {'  '}
          {'█'} {'█'} {' '} {' '} {'█'} {'█'} {' '} {'█'} {'█'} {'█'}
          {'  '}
        </Text>
        <Text bold>
          {'  '}
          {'█'} {'█'} {'█'} {'█'} {'█'} {' '} {' '} {' '} {'█'} {'█'}
          {'  '}
        </Text>
        <Text bold>
          {'  '}
          {'█'} {'█'} {' '} {' '} {'█'} {' '} {' '} {' '} {'█'} {'█'}
          {'  '}
        </Text>
        <Text bold>
          {'  '}
          {'█'} {'█'} {' '} {' '} {'█'} {'█'} {'█'} {'█'} {'█'} {'█'}
          {'  '}
        </Text>
      </Gradient>
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>{subtitle}</Text>
      </Box>
    </Box>
  );
};
