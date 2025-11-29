import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface Hint {
  key: string;
  description: string;
}

interface KeyboardHintsProps {
  hints?: Hint[];
}

const defaultHints: Hint[] = [
  { key: 'j/k ↓↑', description: 'navigate' },
  { key: 'o', description: 'open task' },
  { key: 'd', description: 'show diff' },
  { key: 'm', description: 'merge task' },
  { key: 'x', description: 'drop task' },
  { key: 'q', description: 'quit' },
];

export const KeyboardHints: React.FC<KeyboardHintsProps> = ({ hints = defaultHints }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginTop={1}
    >
      <Box>
        <Text bold dimColor>Keyboard Shortcuts</Text>
      </Box>
      <Box flexDirection="row" marginTop={0.5} gap={2}>
        {hints.map((hint, index) => (
          <Box key={index} marginRight={2}>
            <Text color="cyan" bold>{hint.key}</Text>
            <Text dimColor>: {hint.description}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
