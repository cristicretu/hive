import React from 'react';
import { Text, Box } from 'ink';
import { getConfig, setConfig } from '../lib/config.js';

interface ConfigProps {
  action?: 'get' | 'set';
  configKey?: string;
  value?: string;
}

export default function Config({ action = 'get', configKey, value }: ConfigProps) {
  if (action === 'get') {
    const config = getConfig();
    
    if (configKey) {
      // Show specific key
      const keys = configKey.split('.');
      let val: any = config;
      for (const k of keys) {
        val = val?.[k];
      }
      
      return (
        <Box>
          <Text color="cyan">{configKey}:</Text>
          <Text> {JSON.stringify(val, null, 2)}</Text>
        </Box>
      );
    }
    
    // Show all config
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Hive Configuration</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Default branch: <Text color="cyan">{config.defaultBaseBranch}</Text></Text>
          <Text>Default editor: <Text color="cyan">{config.defaultEditor}</Text></Text>
          <Text>Worktree dir: <Text color="cyan">{config.worktreeDir}</Text></Text>
          <Text>Auto-symlink: <Text color="cyan">{config.autoSymlink ? 'enabled' : 'disabled'}</Text></Text>
          
          {config.ai && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>AI Settings:</Text>
              <Text>  Enabled: <Text color="cyan">{config.ai.enabled ? 'yes' : 'no'}</Text></Text>
              <Text>  Provider: <Text color="cyan">{config.ai.provider}</Text></Text>
              <Text>  Model: <Text color="cyan">{config.ai.model}</Text></Text>
              <Text>  API Key: <Text color="cyan">{config.ai.apiKey ? '***' + config.ai.apiKey.slice(-4) : 'not set'}</Text></Text>
            </Box>
          )}
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>Set values with: hive config set &lt;key&gt; &lt;value&gt;</Text>
        </Box>
      </Box>
    );
  }
  
  if (action === 'set') {
    if (!configKey || value === undefined) {
      return (
        <Text color="red">Usage: hive config set &lt;key&gt; &lt;value&gt;</Text>
      );
    }
    
    try {
      const config = getConfig();
      const keys = configKey.split('.');
      
      // Handle nested keys like "ai.apiKey"
      if (keys.length === 2 && keys[0] === 'ai') {
        const aiConfig = { ...config.ai };
        const aiKey = keys[1] as keyof typeof aiConfig;
        
        // Type conversion for boolean and special fields
        if (aiKey === 'enabled' || aiKey === 'autoReview' || aiKey === 'autoResolveConflicts') {
          (aiConfig as any)[aiKey] = value === 'true';
        } else {
          (aiConfig as any)[aiKey] = value;
        }
        
        setConfig({ ai: aiConfig });
      } else {
        // Direct config key
        const update: any = {};
        if (configKey === 'autoSymlink') {
          update[configKey] = value === 'true';
        } else {
          update[configKey] = value;
        }
        setConfig(update);
      }
      
      return (
        <Box flexDirection="column">
          <Text color="green">✓ Configuration updated</Text>
          <Text dimColor>{configKey} = {value}</Text>
        </Box>
      );
    } catch (err) {
      return (
        <Text color="red">Error: {err instanceof Error ? err.message : 'Unknown error'}</Text>
      );
    }
  }
  
  return <Text>Unknown action</Text>;
}
