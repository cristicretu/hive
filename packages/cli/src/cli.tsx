import React from 'react';
import { Text, Box } from 'ink';

interface CliProps {
  path?: string;
}

/**
 * Main CLI Component
 * Displays help information when no command is specified
 */
export default function Cli({ path: targetPath }: CliProps) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Hive CLI
        </Text>
        <Text> - Parallel AI Agent Workspaces</Text>
      </Box>
      <Text>Version: 0.1.0</Text>
      <Box marginTop={1}>
        <Text dimColor>
          Manage parallel AI agent workspaces using git worktrees
        </Text>
      </Box>
      {targetPath && (
        <Box marginTop={1}>
          <Text dimColor>Working directory: {targetPath}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Run with --help to see available commands</Text>
      </Box>
    </Box>
  );
}
