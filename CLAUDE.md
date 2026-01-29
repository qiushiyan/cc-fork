# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
## Testing Locally

```bash
node ./dist/index.js --help           # Run CLI directly
pnpm link --global                    # Install globally as cc-fork
```

## Architecture

This is a CLI tool (`cc-fork`) that manages Claude Code kickstart sessions. Sessions are stored as markdown files with YAML frontmatter in `.claude/cc-fork/`.

**Session file format:**
```markdown
---
id: <uuid>
created: <iso-timestamp>
updated: <iso-timestamp>
---
<kickstart prompt content>
```

**Code structure:**
- `src/index.ts` - CLI entry point using commander
- `src/commands/` - One file per command (create, fork, refresh, list, delete, edit)
- `src/lib/config.ts` - Path helpers for `.claude/cc-fork/` directory
- `src/lib/session.ts` - Markdown/frontmatter I/O using gray-matter
- `src/lib/claude.ts` - Spawns `claude` CLI with appropriate flags
- `src/lib/prompt.ts` - Readline-based interactive prompts

**Key patterns:**
- Commands are async functions that handle their own error output and `process.exit(1)` on failure
- Session operations use `gray-matter` to parse/stringify YAML frontmatter
- Claude CLI is invoked via `spawn` - print mode for `create`/`refresh`, interactive for `fork`
