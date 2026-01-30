# cc-fork

![cc-fork workflow](./workflow.jpeg)

Stop repeating yourself every time you start a new Claude Code session. cc-fork helps you Create manage Claude Code sessions with pre-loaded codebase context.



## The Problem

When working with Claude Code on complex codebases, you often need to spend the first few minutes guiding Claude to understand your project before you can get to actual work. This means:

1. Starting a fresh session
2. Telling Claude which files to read
3. Waiting for it to build context
4. *Then* asking your actual question

If you work on the same codebase across multiple sessions, you repeat this onboarding ritual every single time.

## The Solution

`cc-fork` lets you create reusable **base sessions** — kickstart prompts that prime Claude with your codebase knowledge. Fork from a base session anytime to get a new working session with context pre-loaded.

**Create once, fork forever.**

## Installation

```bash
npm install -g cc-fork
# or
yarn global add cc-fork
# or
pnpm add -g cc-fork
```

Also available as `ccfork` for faster typing.

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code) to be installed.

## Workflows

### Basic: Create Once, Fork Forever

The core workflow for most users. Create a base session once with your codebase context, then fork it whenever you need a fresh working session.

```bash
# One-time setup: create a base session for a feature area
cc-fork create payments
# Opens your editor — write a prompt that guides Claude through relevant code

# Daily usage: fork when you need to work
cc-fork payments
# Launches Claude with full context, ready for your questions
```

Note: `cc-fork payments` is shorthand for `cc-fork fork payments`.

### Cost-Effective: Build Context with Haiku, Work with Opus

Use a faster, cheaper model to build the initial context, then switch to a more capable model for actual work. This saves cost on the context-building phase.

```bash
# Create base session with haiku (fast and cheap for context building)
cc-fork create payments --model haiku

# Fork with opus for complex reasoning tasks
cc-fork fork payments --model opus
```

### Incremental: Evolve Your Base Session

When you discover new context that should be part of your base session (e.g., "Claude should also know about our testing patterns"), use `use` to add it without reprocessing the original prompt.

```bash
# Resume the base session directly and add more context
cc-fork use payments
# Tell Claude about additional patterns, files, or conventions
# Exit when done — the base session now includes this knowledge

# Future forks will include the new context
cc-fork fork payments
```

### Maintenance: Keep Sessions Fresh

When your codebase changes significantly (major refactor, new architecture), refresh the base session to rebuild Claude's understanding from scratch.

```bash
# Re-run the prompt to rebuild context
cc-fork refresh payments
```

### Team Defaults: Project-Wide Configuration

Set default flags for your entire project so team members don't need to remember them.

```bash
# Create project config with your team's preferences
echo "model: sonnet
dangerously-skip-permissions: true" > .claude/cc-fork/config.yaml

# Now all commands use these defaults automatically
cc-fork create auth        # Uses sonnet, skips permissions
cc-fork fork payments      # Uses sonnet, skips permissions
```

## Claude CLI Flags

Any `claude` CLI flag can be passed through to the underlying command. Flags are resolved from three levels (highest precedence first):

1. **CLI arguments** — Override at runtime: `cc-fork fork payments --model opus`
2. **Session frontmatter** — Stored per-session in the markdown file's YAML header
3. **Project config** — Defaults in `.claude/cc-fork/config.yaml`

Flags passed during `create` are persisted in the session frontmatter. You can also edit them manually with `cc-fork edit <name>`.

**Flag conversion:**

| YAML | Claude CLI |
|------|------------|
| `model: haiku` | `--model haiku` |
| `dangerously-skip-permissions: true` | `--dangerously-skip-permissions` |
| `dangerously-skip-permissions: false` | *(omitted)* |
| `allowedTools: ["Bash(git *)", "Read"]` | `--allowedTools "Bash(git *)" "Read"` |

Boolean `false` means "don't pass this flag" — useful for overriding a project-level `true`.

**Project config example** (`.claude/cc-fork/config.yaml`):

```yaml
model: sonnet
dangerously-skip-permissions: true
```

## CLI Reference

### `create` (alias: `new`)

Create a new base session.

```
cc-fork create [name] [options] [-- claude-flags...]
```

| Option | Description |
|--------|-------------|
| `-p, --prompt <text>` | Provide prompt inline, skipping the editor |
| `-i, --interactive` | Enter Claude Code directly after sending the prompt |

Without `-p`, opens `$EDITOR` (falls back to `$VISUAL`, then `vi`) to write the session prompt. With `-p`, the prompt is written directly and the editor is skipped.

Without `-i`, a spinner is shown while Claude processes the prompt. With `-i`, you enter Claude Code and can interact in real-time.

If the session already exists with an ID, an interactive menu offers to refresh, edit, or exit.

### `fork` (default command)

Fork from a base session for daily work. This is the default command — `cc-fork payments` is equivalent to `cc-fork fork payments`.

```
cc-fork fork <name> [-- claude-flags...]
```

Creates an isolated working session branched from the base. The base session is unchanged.

### `use`

Resume a base session directly to add more context.

```
cc-fork use <name> [-- claude-flags...]
```

Unlike `fork`, context accumulates in the base session. Future forks inherit the added context.

### `refresh` (alias: `rebuild`)

Rebuild a base session with a new session ID using the current prompt.

```
cc-fork refresh <name> [options] [-- claude-flags...]
```

| Option | Description |
|--------|-------------|
| `-i, --interactive` | Enter Claude Code directly after sending the prompt |

Use after major codebase changes to rebuild Claude's understanding from scratch. The prompt content is preserved; only the session ID is regenerated.

### `list`

List all sessions with name, dates, and status.

```
cc-fork list
```

### `edit`

Open a session file in `$EDITOR` for manual editing.

```
cc-fork edit <name>
```

Run `cc-fork refresh <name>` afterward to rebuild with updated content.

### `delete`

Delete one or more sessions.

```
cc-fork delete <names...> [options]
```

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation prompt |

## How It Works

Sessions are stored as markdown files in `.claude/cc-fork/`. Each file contains your prompt with YAML frontmatter tracking the session ID:

```
.claude/cc-fork/
├── payments.md
├── auth.md
└── checkout.md
```

When you `create`, Claude runs your prompt and saves the session ID. When you `fork`, Claude resumes from that session with `--fork-session`, giving you a fresh working session with all the context intact. When you `use`, Claude resumes the base session directly, allowing you to incrementally add context without reprocessing the original prompt.

It is recommended to commit the `.claude/cc-fork/` directory to version control so your team can share and evolve base sessions together.

## License

MIT
