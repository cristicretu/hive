import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import { getTasksByStatus } from '../lib/tasks.js';
import { analyzeAllTasks } from '../lib/git-analysis.js';
import { analyzeBatchTasks, SyncReport } from '../lib/ai/batch-review.js';

interface SyncProps {
  path?: string;
}

type Status = 'loading' | 'analyzing' | 'ai-review' | 'success' | 'error';

export default function Sync({ path }: SyncProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>('');
  const [report, setReport] = useState<SyncReport | null>(null);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    const performSync = async () => {
      try {
        setStatus('loading');

        // Get all active tasks
        const tasks = await getTasksByStatus('active');
        
        if (tasks.length === 0) {
          setError('No active tasks found. Create tasks first with: hive new "description"');
          setStatus('error');
          return;
        }

        if (tasks.length === 1) {
          setError('Only 1 active task found. Sync is useful for analyzing multiple parallel tasks.');
          setStatus('error');
          return;
        }

        setTaskCount(tasks.length);
        setStatus('analyzing');

        // Analyze git changes
        const { taskAnalyses, overlaps } = await analyzeAllTasks(tasks);

        setStatus('ai-review');

        // Get AI analysis
        const syncReport = await analyzeBatchTasks(taskAnalyses, overlaps);

        setReport(syncReport);
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    };

    performSync();
  }, [path]);

  if (status === 'loading') {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Loading active tasks...</Text>
      </Box>
    );
  }

  if (status === 'analyzing') {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Analyzing {taskCount} tasks and detecting overlaps...</Text>
      </Box>
    );
  }

  if (status === 'ai-review') {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> AI analyzing conflicts and merge strategy...</Text>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (!report) {
    return <Text color="red">No report data</Text>;
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text bold>Master AI Analysis</Text>
        <Box marginTop={1}>
          <Text dimColor>{report.overallAssessment}</Text>
        </Box>
      </Box>

      {/* Task Summaries */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Tasks ({report.taskSummaries.length})</Text>
        {report.taskSummaries.map((task, i) => (
          <Box key={i} flexDirection="column" marginTop={1} marginLeft={2}>
            <Box>
              <Text bold color="cyan">{task.slug}</Text>
              <Text dimColor> [{task.impact}]</Text>
            </Box>
            <Box marginLeft={2}>
              <Text>{task.summary}</Text>
            </Box>
            {task.concerns.length > 0 && (
              <Box marginLeft={2} flexDirection="column">
                {task.concerns.map((concern, j) => (
                  <Text key={j} color="yellow">⚠ {concern}</Text>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Conflicts */}
      {report.conflicts.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="red">Predicted Conflicts ({report.conflicts.length})</Text>
          {report.conflicts.map((conflict, i) => (
            <Box key={i} flexDirection="column" marginTop={1} marginLeft={2}>
              <Box>
                <Text color={conflict.severity === 'critical' ? 'red' : conflict.severity === 'warning' ? 'yellow' : 'cyan'}>
                  [{conflict.severity.toUpperCase()}]
                </Text>
                <Text bold> {conflict.file}</Text>
              </Box>
              <Box marginLeft={2} flexDirection="column">
                <Text dimColor>Affected: {conflict.affectedTasks.join(', ')}</Text>
                <Text>Type: {conflict.conflictType}</Text>
                <Text marginTop={1}>{conflict.analysis}</Text>
                <Box marginTop={1}>
                  <Text color="green">→ Resolution: </Text>
                  <Text>{conflict.suggestedResolution}</Text>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Merge Strategy */}
      <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="green" padding={1}>
        <Text bold color="green">Recommended Merge Strategy</Text>
        
        <Box marginTop={1} flexDirection="column">
          <Text bold>Order:</Text>
          {report.mergeStrategy.recommendedOrder.map((task, i) => (
            <Box key={i} marginLeft={2}>
              <Text color="cyan">{i + 1}.</Text>
              <Text> {task}</Text>
            </Box>
          ))}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Reasoning:</Text>
          <Text marginLeft={2}>{report.mergeStrategy.reasoning}</Text>
        </Box>

        {report.mergeStrategy.alternatives && report.mergeStrategy.alternatives.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Alternatives:</Text>
            {report.mergeStrategy.alternatives.map((alt, i) => (
              <Text key={i} marginLeft={2} dimColor>• {alt}</Text>
            ))}
          </Box>
        )}
      </Box>

      {/* Next Steps */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Next Steps:</Text>
        <Text marginLeft={2}>Review the conflicts and merge strategy above</Text>
        <Text marginLeft={2}>Merge tasks in the recommended order:</Text>
        {report.mergeStrategy.recommendedOrder.map((task, i) => (
          <Text key={i} marginLeft={4} dimColor>
            hive merge {task}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
