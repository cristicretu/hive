# 🐝 Hive [![npm version](https://img.shields.io/npm/v/@cristicretu/hive-cli.svg)](https://www.npmjs.com/package/@cristicretu/hive-cli)


parallel ai agents without the pain

<img src="./media/cover.png" />

---

you know the deal. you want 3 agents working on 3 tasks. but they all stomp on each other's files. git history becomes a nightmare. you're back to being single-threaded.

hive fixes this. git worktrees + a nice cli. each agent gets its own branch, its own directory, its own sandbox. work in parallel. merge what works. drop what doesn't.

[anthropic recommends](https://www.anthropic.com/engineering/claude-code-best-practices) using git worktrees for parallel claude code sessions. this skips the manual work.


<img src="./media/cli.png" />

## install

```bash
# npm
npm i -g @cristicretu/hive-cli

# bun
bun add -g @cristicretu/hive-cli

# pnpm
pnpm add -g @cristicretu/hive-cli
```

## usage

```bash
# launch interactive tui
hive

# create a new workspace
hive new "add user authentication"

# list all workspaces
hive list

# merge a workspace back to main
hive merge my-task

# drop a workspace
hive drop my-task
```

## why

because alt-tabbing between branches is mass and ai agents don't know how to share

## license

MIT. do whatever you want.
