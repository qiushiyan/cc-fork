# Technical Overview

CLI tool for managing Claude Code kickstart sessions. Wraps the `claude` CLI with session persistence and a three-level flag configuration system.

**Core abstraction:** Sessions are markdown files with YAML frontmatter. The frontmatter stores a Claude session UUID plus arbitrary CLI flags. Commands read/merge/pass these flags to `claude`.

## Architecture

```
CLI Entry (commander)
    ↓
Commands (src/commands/*.ts)
    ↓
Libraries (src/lib/*.ts)
    ├── session.ts   → gray-matter I/O
    ├── flags.ts     → parse/merge/convert flags
    ├── config.ts    → paths + project config
    ├── claude.ts    → spawn claude CLI
    └── prompt.ts    → editor/readline
```

**CLI aliases:** `cc-fork` and `ccfork` (both point to the same binary).

**Default command:** `fork` is the default command. Running `cc-fork <name>` is equivalent to `cc-fork fork <name>`. This is implemented by checking if the first argument is a known command; if not, `fork` is prepended to `process.argv`.

**Command aliases:** `rebuild` is an alias for `refresh`.

**Key files:**

```
src/
├── index.ts              # Commander setup, arg parsing, default command logic
├── types.ts              # SessionFrontmatter, ClaudeFlags, ClaudeResponse
├── commands/
│   ├── create.ts         # New base session (generates UUID)
│   ├── fork.ts           # Branch from base (--fork-session)
│   ├── use.ts            # Resume base directly (context accumulates)
│   └── refresh.ts        # Rebuild base (new UUID, same prompt)
└── lib/
    ├── flags.ts          # extractFlags, mergeFlags, flagsToArgs, parseCliArgs
    ├── session.ts        # readSession, writeSession, listSessions
    ├── config.ts         # readProjectConfig, getSessionPath
    └── claude.ts         # createBaseSession, createBaseSessionInteractive, forkSession, resumeSession
```

## Session Storage

Sessions live in `.claude/cc-fork/` as markdown with YAML frontmatter:

```yaml
---
id: 550e8400-e29b-41d4-a716-446655440000
created: 2024-01-27T18:28:00.000Z
updated: 2024-01-27T18:28:00.000Z
model: haiku
dangerously-skip-permissions: true
---
# Payments Module

Read these files to understand the payment flow...
```

**Reserved keys** (`id`, `created`, `updated`) are managed by cc-fork. Everything else passes through to `claude` as CLI flags.

Gray-matter handles parsing. For project config (`config.yaml`), we wrap the content with `---` delimiters since it's pure YAML, not markdown.

## Flag System

Three levels of configuration, merged with later levels winning:

```
project config  <  session frontmatter  <  CLI arguments
```

**Merge implementation** (`src/lib/flags.ts`):

```typescript
const effectiveFlags = mergeFlags(
  mergeFlags(projectConfig, sessionFlags),
  cliFlags
);
```

**Conversion to CLI args** (`flagsToArgs`):

| Input | Output |
|-------|--------|
| `{ model: "haiku" }` | `["--model", "haiku"]` |
| `{ "dangerously-skip-permissions": true }` | `["--dangerously-skip-permissions"]` |
| `{ "dangerously-skip-permissions": false }` | `[]` (omitted) |
| `{ allowedTools: ["Bash(git *)", "Read"] }` | `["--allowedTools", "Bash(git *)", "Read"]` |

Boolean `false` means "don't pass this flag" — useful for overriding a `true` from project config.

**CLI argument formats** (`parseCliArgs`):

- `--key value` and `--key=value` are both supported.
- A standalone `--` terminator is ignored by the parser, so users can include it without breaking flag handling.

## Command Data Flow

### create

1. Open editor for prompt
2. Generate UUID
3. Merge: `projectConfig + cliFlags`
4. Spawn: `claude --session-id <uuid> -p <prompt> --output-format json ...flags`
5. Write frontmatter with UUID + flags

### fork

1. Read session, extract UUID + flags
2. Merge: `projectConfig + sessionFlags + cliFlags`
3. Spawn: `claude --resume <uuid> --fork-session ...flags`

Fork creates a new working session branched from the base. The base session UUID is unchanged.

### use

1. Read session, extract UUID + flags
2. Merge: `projectConfig + sessionFlags + cliFlags`
3. Spawn: `claude --resume <uuid> ...flags`

Unlike fork, this resumes the base session directly. Context accumulates in the same UUID. Future forks inherit the accumulated context.

### refresh

1. Read session content + flags
2. Generate **new** UUID
3. Merge: `projectConfig + sessionFlags + cliFlags`
4. Spawn with new UUID
5. Update frontmatter: new `id`, same `created`, new `updated`

Rebuilds context from the original prompt. Use after major codebase changes. Supports CLI flag overrides (e.g., `--model haiku`).

## Claude CLI Integration

Four spawn patterns in `src/lib/claude.ts`:

| Function | Flags | stdio | Returns |
|----------|-------|-------|---------|
| `createBaseSession` | `--session-id`, `-p`, `--output-format json` | capture stdout/stderr | `ClaudeResponse` |
| `createBaseSessionInteractive` | `--session-id`, positional prompt | inherit all | void |
| `forkSession` | `--resume`, `--fork-session` | inherit stdin/stdout, capture stderr | void |
| `resumeSession` | `--resume` | inherit stdin/stdout, capture stderr | void |

`createBaseSession` captures JSON output for the session ID and cost. `createBaseSessionInteractive` passes the prompt as a positional argument (not `-p`), which starts Claude Code in interactive mode. The interactive commands (`fork`, `use`) inherit stdin/stdout for full terminal control, but capture stderr to detect stale session errors.

### Interactive Mode (`-i` flag)

When `create` or `refresh` is called with `-i`, they use `createBaseSessionInteractive` instead of `createBaseSession`. This runs `claude --session-id <uuid> "<prompt>"` which enters Claude Code directly, allowing the user to see output in real-time and continue interacting. Without `-i`, a spinner is shown while waiting for Claude to finish.

## Design Decisions

**Gray-matter for storage.** Sessions are primarily prompts (markdown). Frontmatter adds structure without sacrificing readability. Files are git-friendly and editable with any text editor.

**UUID-based identity.** Session names are for humans; UUIDs identify Claude context. Names can change (rename file), but the UUID points to the same conversation history.

**Fork vs. use distinction.** Two evolution patterns:
- Fork: isolated working sessions (daily use)
- Use: incremental base session refinement (add context over time)

**Three-level flags.** Enables team defaults (project config) with per-session overrides and CLI escape hatches. The merge is simple object spread—last write wins.

**Fail-fast validation.** All commands validate inputs early and call `process.exit(1)` on errors. No exceptions bubble up.

## Error Handling

Commands follow this pattern:

```typescript
try {
  validateSessionName(name);
} catch (err) {
  console.error(chalk.red(err.message));
  process.exit(1);
}
```

`listSessions` is resilient—one corrupted file doesn't break the list. Errors are collected and reported separately.

Project config gracefully handles missing file (returns `{}`), but propagates other errors (permissions, parse failures).

### Stale Session Detection

When a user clears their Claude Code sessions (or the session ID becomes invalid for any reason), `fork` and `use` commands detect the "No conversation found" error from the Claude CLI and display a helpful message:

```
Session 'payments' has a stale session ID. Run 'cc-fork refresh payments' to rebuild.
No conversation found with session ID: abc-123...
```

Implementation: `forkSession` and `resumeSession` capture stderr (while inheriting stdin/stdout for interactivity). On non-zero exit, they check for the stale session pattern and throw a `SessionError` with the helpful message and captured stderr attached.

## Testing

Tests are in `tests/` using vitest. Key test files:

- `tests/lib/flags.test.ts` — Flag parsing, merging, conversion
- `tests/lib/config.test.ts` — Project config loading
- `tests/lib/claude.test.ts` — Claude CLI spawning, stale session detection
- `tests/commands/fork.test.ts` — Flag passthrough from frontmatter/config
- `tests/commands/create.test.ts` — Flag storage in frontmatter

Mock pattern: Commands are tested by mocking `session.ts`, `config.ts`, and `claude.ts`. The flag utilities are tested directly.
