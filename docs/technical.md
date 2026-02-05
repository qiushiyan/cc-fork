# Technical Overview

Internal documentation for cc-fork developers. For user documentation, see [README.md](../README.md).

## Architecture

```
CLI Entry (commander)
    ↓
Commands (src/commands/*.ts)
    ↓
Libraries (src/lib/*.ts)
    ├── session.ts      → gray-matter I/O for prompts
    ├── user-storage.ts → user-level session metadata
    ├── git.ts          → git remote detection
    ├── flags.ts        → parse/merge/convert flags
    ├── config.ts       → paths + project config
    ├── claude.ts       → spawn claude CLI
    └── prompt.ts       → editor/readline/choose menu
```

**Key files:**

```
src/
├── index.ts              # Commander setup, default command injection
├── types.ts              # TypeScript interfaces
├── commands/
│   ├── create.ts         # New base session
│   ├── fork.ts           # Branch from base
│   ├── use.ts            # Resume base directly
│   ├── refresh.ts        # Rebuild with new UUID
│   └── delete.ts         # Delete sessions
└── lib/
    ├── flags.ts          # extractFlags, mergeFlags, flagsToArgs
    ├── session.ts        # readSession, writeSession, listSessions
    ├── user-storage.ts   # readUserSession, writeUserSession, getProjectId
    ├── git.ts            # getGitRemoteOrigin, normalizeGitUrl
    ├── config.ts         # readProjectConfig, getSessionPath
    ├── claude.ts         # Claude CLI spawn functions
    └── prompt.ts         # User interaction utilities
```

## Storage Model

### Prompt Files (`.claude/cc-fork/*.md`)

Markdown with YAML frontmatter. Contains only Claude CLI flags—no session state.

```yaml
---
model: haiku
---
# Prompt content here
```

Parsed with `gray-matter`. Reserved keys (`id`, `created`, `updated`) are filtered out by `extractFlags()` to prevent passing them as CLI flags.

### User Storage (`~/.cc-fork/<project-id>/*.json`)

Local session metadata, never committed:

```json
{
  "id": "550e8400-...",
  "created": "2024-01-27T18:28:00.000Z",
  "updated": "2024-01-27T18:28:00.000Z",
  "promptHash": "abc123def456"
}
```

**Error handling:** Corrupted JSON returns `null` with a warning (doesn't crash).

### Project ID Derivation

Priority order in `getProjectId()`:

1. `config.yaml` → `projectId` (sanitized for path safety)
2. Git remote origin → `<repo-name>-<hash>`
3. Absolute path → `<dirname>-<hash>`

**Security:** `sanitizeProjectId()` strips `..`, path separators, and unsafe characters to prevent directory traversal.

**Caching:** Project ID is cached per-process to avoid redundant git calls.

## Command Data Flow

### create

1. Check user storage for existing ID → show conflict menu if exists
2. Get prompt (editor or `-p` flag)
3. Generate UUID, spawn Claude
4. Write flags to frontmatter, metadata to user storage

### fork / use

1. Read flags from frontmatter, UUID from user storage
2. Check `promptHash` → warn if stale
3. Merge flags (session < CLI)
4. Spawn Claude with `--resume` (+ `--fork-session` for fork)

### refresh

1. Read prompt + flags from frontmatter
2. Preserve `created` timestamp from user storage
3. Generate new UUID, spawn Claude
4. Update user storage with new ID + promptHash

### delete

1. Validate names, check existence
2. Confirm (unless `--force`)
3. Delete markdown + user storage
4. With `--force`: clean user storage even if markdown missing

## Claude CLI Integration

| Function | Mode | Key Flags |
|----------|------|-----------|
| `createBaseSession` | Non-interactive | `--session-id`, `-p`, `--output-format json` |
| `createBaseSessionInteractive` | Interactive | `--session-id`, positional prompt |
| `forkSession` | Interactive | `--resume`, `--fork-session` |
| `resumeSession` | Interactive | `--resume` |

Interactive functions inherit stdin/stdout but capture stderr for stale session detection.

## Flag System

**Merge order:** `session frontmatter < CLI arguments`

**Conversion (`flagsToArgs`):**
- `{ key: "value" }` → `["--key", "value"]`
- `{ flag: true }` → `["--flag"]`
- `{ flag: false }` → `[]` (omitted)
- `{ arr: ["a", "b"] }` → `["--arr", "a", "b"]`

## Error Handling

**Pattern:** Validate early, `process.exit(1)` on failure.

**Resilience:**
- `listSessions`: Collects errors, doesn't fail on single corrupted file
- `readUserSession`: Returns `null` on corrupted JSON (with warning)
- `readProjectConfig`: Returns `{}` on missing file

**Stale session detection:** `forkSession`/`resumeSession` check stderr for "No conversation found" and throw `SessionError` with recovery hint.

## Testing

Tests in `tests/` using vitest.

**Mock pattern:** Commands mock `session.ts`, `config.ts`, `user-storage.ts`, `claude.ts`. Flag utilities tested directly.

**Key test files:**
- `flags.test.ts` — Flag parsing, merging, conversion
- `config.test.ts` — Config parsing, unknown key filtering
- `claude.test.ts` — CLI spawning, stale session detection
- `fork.test.ts`, `create.test.ts` — Command integration
