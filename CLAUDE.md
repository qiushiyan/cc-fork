# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
pnpm build                            # Build with tsup (ESM bundle → dist/)
pnpm dev                              # Build in watch mode
pnpm typecheck                        # Type-check without emitting
pnpm test                             # Run vitest (watch mode by default)
pnpm test -- --run                    # Run tests once (CI-style)
pnpm test -- tests/lib/flags.test.ts  # Run a single test file
node ./dist/index.js --help           # Run CLI directly after build
pnpm link --global                    # Install globally as cc-fork
```

Package manager is **pnpm** (10.27.0). No linter or formatter is configured.

## Architecture

CLI tool (`cc-fork`) that manages Claude Code kickstart sessions — reusable markdown prompts with Claude CLI flags stored as YAML frontmatter.

**Two-tier storage model:**
- **Prompt files** (committed): `.claude/cc-fork/<name>.md` — markdown with YAML frontmatter containing Claude CLI flags and prompt content. Parsed with `gray-matter`.
- **User session data** (not committed): `~/.cc-fork/<project-id>/<name>.json` — session IDs, timestamps, and prompt hash for staleness detection. Project ID derived from: config `projectId` > git remote origin > cwd path hash.

**Session file format:**
```markdown
---
model: haiku
allowedTools:
  - Bash(git *)
  - Read
---
<kickstart prompt content>
```

Frontmatter keys `id`, `created`, `updated` are reserved (`RESERVED_KEYS` in `types.ts`) and filtered out by `extractFlags()` before passing to Claude CLI.

**Code structure:**
- `src/index.ts` — CLI entry with commander; injects default command (`fork`) when first arg is unrecognized
- `src/commands/` — One async function per command (create, fork, use, refresh, list, delete, edit). Each handles its own errors and calls `process.exit(1)` on failure.
- `src/lib/flags.ts` — Flag extraction, merging (session frontmatter < CLI args), and conversion to CLI args array
- `src/lib/session.ts` — Markdown/frontmatter I/O with `gray-matter`
- `src/lib/user-storage.ts` — User-level session metadata at `~/.cc-fork/`, with project ID caching and path sanitization
- `src/lib/claude.ts` — Spawns `claude` CLI via `child_process.spawn`
- `src/lib/config.ts` — Path helpers for `.claude/cc-fork/` and project config parsing
- `src/lib/git.ts` — Git remote origin detection and URL normalization
- `src/lib/prompt.ts` — Readline-based interactive prompts and editor launching

**Flag conversion rules** (`flagsToArgs`):
- `string` → `["--key", "value"]`
- `true` → `["--key"]`
- `false` → omitted
- `string[]` → `["--key", "val1", "val2"]`

**Build:** tsup bundles to a single ESM file with shebang. `PKG_VERSION` is injected at build time via `define`.

**Testing:** Vitest with explicit imports (no globals). Commands are tested with mocked dependencies; lib utilities are tested directly. Test timeout is 10s.
