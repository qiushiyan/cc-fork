import {
  RESERVED_KEYS,
  type ClaudeFlags,
  type SessionFrontmatter,
} from "../types.js";

/**
 * Extract claude flags from frontmatter (excludes reserved keys)
 */
export function extractFlags(frontmatter: SessionFrontmatter): ClaudeFlags {
  const flags: ClaudeFlags = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!RESERVED_KEYS.includes(key as any) && value !== undefined) {
      flags[key] = value;
    }
  }
  return flags;
}

/**
 * Merge flags with proper precedence (overrides win)
 */
export function mergeFlags(
  base: ClaudeFlags,
  overrides: ClaudeFlags
): ClaudeFlags {
  return { ...base, ...overrides };
}

/**
 * Convert flags object to CLI args array
 *
 * Examples:
 *   { model: "haiku" } => ["--model", "haiku"]
 *   { "dangerously-skip-permissions": true } => ["--dangerously-skip-permissions"]
 *   { "dangerously-skip-permissions": false } => []
 *   { allowedTools: ["Bash(git *)", "Read"] } => ["--allowedTools", "Bash(git *)", "Read"]
 */
export function flagsToArgs(flags: ClaudeFlags): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(flags)) {
    if (value === false) {
      continue;
    }

    if (value === true) {
      args.push(`--${key}`);
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        args.push(`--${key}`, ...value);
      }
    } else {
      args.push(`--${key}`, value);
    }
  }

  return args;
}

/**
 * Parse CLI args array into flags object
 *
 * Input: ["--model", "haiku", "--dangerously-skip-permissions"]
 * Output: { model: "haiku", "dangerously-skip-permissions": true }
 *
 * Note: This is a simple parser that handles:
 * - --key value (string)
 * - --key (boolean true)
 * - Does not handle arrays (use frontmatter for that)
 */
export function parseCliArgs(args: string[]): ClaudeFlags {
  const flags: ClaudeFlags = {};

  for (let i = 0; i < args.length; i++) {
    const arg: string | undefined = args[i];
    if (arg === undefined) continue;

    if (arg === "--") {
      continue;
    }

    if (arg.startsWith("--")) {
      const rawKey = arg.slice(2);
      if (!rawKey) continue;

      const eqIndex = rawKey.indexOf("=");
      if (eqIndex !== -1) {
        const key = rawKey.slice(0, eqIndex);
        if (!key) continue;
        const rawValue = rawKey.slice(eqIndex + 1);
        if (rawValue === "true") {
          flags[key] = true;
        } else if (rawValue === "false") {
          flags[key] = false;
        } else {
          flags[key] = rawValue;
        }
        continue;
      }

      const key = rawKey;
      if (!key) continue;
      const nextArg: string | undefined = args[i + 1];

      if (nextArg !== undefined && !nextArg.startsWith("--")) {
        if (nextArg === "true") {
          flags[key] = true;
        } else if (nextArg === "false") {
          flags[key] = false;
        } else {
          flags[key] = nextArg;
        }
        i += 1;
      } else {
        flags[key] = true;
      }
    }
  }

  return flags;
}
