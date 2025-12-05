import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import { getDiffStats, getFullDiff } from '../lib/git.js';
import { reviewCode, ReviewResult } from '../lib/ai/index.js';

interface ReviewProps {
  task: string;
  path?: string;
}

type Status = 'loading' | 'reviewing' | 'success' | 'error';

export default function Review({ task, path }: ReviewProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>('');
  const [review, setReview] = useState<ReviewResult | null>(null);

  useEffect(() => {
    const performReview = async () => {
      try {
        setStatus('loading');

        const diffStats = await getDiffStats(task);
        const fullDiff = await getFullDiff(task);

        if (diffStats.totalFiles === 0) {
          setError('No changes to review');
          setStatus('error');
          return;
        }

        setStatus('reviewing');

        const result = await reviewCode(fullDiff, {
          files: diffStats.files.map(f => f.file),
          additions: diffStats.totalInsertions,
          deletions: diffStats.totalDeletions,
        });

        setReview(result);
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    };

    performReview();
  }, [task]);

  if (status === 'loading') {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Analyzing changes...</Text>
      </Box>
    );
  }

  if (status === 'reviewing') {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> AI review in progress...</Text>
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

  if (!review) {
    return <Text color="red">No review data</Text>;
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text bold>AI Code Review</Text>
        <Box marginTop={1}>
          <Text dimColor>{review.summary}</Text>
        </Box>
      </Box>

      {review.concerns.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">Issues Found ({review.concerns.length})</Text>
          {review.concerns.map((concern, i) => (
            <Box key={i} flexDirection="column" marginTop={1} marginLeft={2}>
              <Box>
                <Text color={concern.severity === 'critical' ? 'red' : concern.severity === 'warning' ? 'yellow' : 'cyan'}>
                  [{concern.severity.toUpperCase()}]
                </Text>
                <Text> {concern.file}</Text>
                {concern.line && <Text dimColor>:{concern.line}</Text>}
              </Box>
              <Box marginLeft={2} flexDirection="column">
                <Text>{concern.title}</Text>
                <Text dimColor>{concern.description}</Text>
                {concern.suggestion && (
                  <Text color="green">→ {concern.suggestion}</Text>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {review.positives.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="green">Positive</Text>
          {review.positives.map((positive, i) => (
            <Box key={i} marginLeft={2}>
              <Text color="green">✓</Text>
              <Text> {positive}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1} paddingTop={1} borderStyle="single" borderTop paddingX={1}>
        <Text bold>Recommendation: </Text>
        <Text
          bold
          color={
            review.recommendation === 'approve'
              ? 'green'
              : review.recommendation === 'request-changes'
              ? 'red'
              : 'yellow'
          }
        >
          {review.recommendation.toUpperCase().replace('-', ' ')}
        </Text>
      </Box>
    </Box>
  );
}
