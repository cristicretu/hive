import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import Cli from './cli.js';
import NewCommand from './commands/new.js';
import ListCommand from './commands/list.js';
import StatusCommand from './commands/status.js';
import OpenCommand from './commands/open.js';
import DiffCommand from './commands/diff.js';
import MergeCommand from './commands/merge.js';
import DropCommand from './commands/drop.js';
import CleanCommand from './commands/clean.js';
import InteractiveCommand from './commands/interactive.js';

const cli = meow(
	`
	Usage
	  $ hive <command> [options]

	Commands
	  new <description>     Create a new hive workspace
	  list                  List all hive workspaces
	  status                Show status of all hive workspaces
	  open <task>           Open a hive workspace in your editor
	  diff <task>           Show differences between workspace and main branch
	  merge <task>          Merge a hive workspace back to main branch
	  drop <task>           Remove a hive workspace
	  clean                 Remove stale worktrees

	Global Options
	  --path, -p            Path to git repository (defaults to current directory)
	  --help                Show help
	  --version             Show version

	Clean Options
	  --stale <time>        Remove tasks inactive for this duration (e.g., "7d", "14d")
	  --force               Remove without confirmation
	  --dry-run             Show what would be removed without removing

	Examples
	  $ hive new "add user authentication"
	  $ hive list
	  $ hive status
	  $ hive open my-task --cursor
	  $ hive diff my-task
	  $ hive merge my-task
	  $ hive drop my-task --force
	  $ hive clean --stale 14d
	  $ hive clean --dry-run
	  $ hive --path /path/to/repo status
`,
	{
		importMeta: import.meta,
		flags: {
			path: {
				type: 'string',
				shortFlag: 'p',
			},
			open: {
				type: 'boolean',
			},
			stat: {
				type: 'boolean',
			},
			cursor: {
				type: 'boolean',
			},
			code: {
				type: 'boolean',
			},
			claude: {
				type: 'boolean',
			},
			terminal: {
				type: 'boolean',
			},
			noDelete: {
				type: 'boolean',
			},
			force: {
				type: 'boolean',
			},
			stale: {
				type: 'string',
			},
			dryRun: {
				type: 'boolean',
			},
		},
	},
);

const [command, ...args] = cli.input;
const flags = cli.flags;

// Route to appropriate command
let component;

switch (command) {
	case 'new':
		component = <NewCommand description={args[0]} open={flags.open} path={flags.path} />;
		break;
	case 'list':
		component = <ListCommand path={flags.path} />;
		break;
	case 'status':
		component = <StatusCommand path={flags.path} />;
		break;
	case 'open':
		component = (
			<OpenCommand
				task={args[0]}
				cursor={flags.cursor}
				code={flags.code}
				claude={flags.claude}
				terminal={flags.terminal}
				path={flags.path}
			/>
		);
		break;
	case 'diff':
		component = <DiffCommand task={args[0]} stat={flags.stat} path={flags.path} />;
		break;
	case 'merge':
		component = <MergeCommand task={args[0]} noDelete={flags.noDelete} path={flags.path} />;
		break;
	case 'drop':
		component = <DropCommand task={args[0]} force={flags.force} path={flags.path} />;
		break;
	case 'clean':
		component = <CleanCommand stale={flags.stale} force={flags.force} dryRun={flags.dryRun} />;
		break;
	default:
		// Default to interactive mode when no command specified
		component = <InteractiveCommand path={flags.path} />;
		break;
}

render(component);
