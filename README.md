# cc-fork

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

## Commands

| Command | Description |
|---------|-------------|
| `cc-fork <name>` | Fork from a base session (default command) |
| `cc-fork create [name]` | Create a new base session |
| `cc-fork use <name>` | Resume base session to add more context |
| `cc-fork refresh <name>` | Rebuild base session (use when session becomes stale) |
| `cc-fork list` | List all sessions |
| `cc-fork edit <name>` | Edit a session's prompt |
| `cc-fork delete <name>` | Delete a session |

`rebuild` is an alias for `refresh`.

### Interactive Mode

By default, `create` and `refresh` show a spinner while waiting for Claude. Use `-i` to enter Claude Code directly after sending the prompt:

```bash
cc-fork create payments -i    # Enter Claude Code after prompt is sent
cc-fork refresh payments -i   # Same for refresh
```

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

## Claude CLI Flags

Any Claude CLI flag can be passed through to the underlying `claude` command. Flags can be set at three levels (in order of precedence):

1. **CLI arguments** (highest) - Override flags at runtime
2. **Session frontmatter** - Stored per-session in the markdown file
3. **Project config** (lowest) - Default flags in `.claude/cc-fork/config.yaml`

### Passing Flags via CLI

```bash
# Create a session with a specific model
cc-fork create payments --model haiku --dangerously-skip-permissions

# Fork with a different model (overrides stored settings)
cc-fork fork payments --model opus

# Refresh with a different model (one-time override)
cc-fork refresh payments --model haiku

# Override boolean flags
cc-fork fork payments --dangerously-skip-permissions false
```

### Session Frontmatter

Flags passed during `create` are stored in the session's YAML frontmatter:

```yaml
---
id: abc-123
created: '2024-01-01T00:00:00.000Z'
updated: '2024-01-01T00:00:00.000Z'
model: haiku
dangerously-skip-permissions: true
---
Your kickstart prompt here...
```

You can also manually edit the frontmatter with `cc-fork edit <name>`.

### Project Config

Create `.claude/cc-fork/config.yaml` under the active project directory to set default flags for all sessions:

```yaml
# .claude/cc-fork/config.yaml
model: sonnet
dangerously-skip-permissions: true
```

### Flag Conversion

| YAML | Claude CLI |
|------|------------|
| `model: haiku` | `--model haiku` |
| `dangerously-skip-permissions: true` | `--dangerously-skip-permissions` |
| `dangerously-skip-permissions: false` | (omitted) |
| `allowedTools: ["Bash(git *)", "Read"]` | `--allowedTools "Bash(git *)" "Read"` |

## License

MIT
