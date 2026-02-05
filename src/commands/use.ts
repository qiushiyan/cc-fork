import chalk from "chalk";
import {
  readSession,
  sessionExists,
  validateSessionName,
} from "../lib/session.js";
import { resumeSession, type SessionError } from "../lib/claude.js";
import { getSessionPath } from "../lib/config.js";
import { extractFlags, mergeFlags } from "../lib/flags.js";
import { readUserSession, computePromptHash } from "../lib/user-storage.js";
import type { ClaudeFlags } from "../types.js";

export async function use(
  name: string,
  cliFlags: ClaudeFlags = {}
): Promise<void> {
  try {
    validateSessionName(name);
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  const exists = await sessionExists(name);
  if (!exists) {
    console.error(
      chalk.red(
        `Session '${name}' not found. Run 'cc-fork create ${name}' first.`
      )
    );
    process.exit(1);
  }

  let session;
  try {
    session = await readSession(name);
  } catch (err) {
    console.error(
      chalk.red(
        `Failed to read session '${name}'. The file may be corrupted. Fix or delete: ${getSessionPath(
          name
        )}`
      )
    );
    process.exit(1);
  }

  // Read session ID from user storage
  const userData = await readUserSession(name);
  if (!userData?.id) {
    console.error(
      chalk.red(
        `Session '${name}' has no base session. Run 'cc-fork create ${name}' first.`
      )
    );
    process.exit(1);
  }

  // Check for stale prompt (content changed since last refresh)
  if (userData.promptHash) {
    const currentHash = computePromptHash(session.content);
    if (currentHash !== userData.promptHash) {
      console.log(
        chalk.yellow(
          `Warning: Prompt content has changed since last refresh. Consider running 'cc-fork refresh ${name}'.`
        )
      );
    }
  }

  const sessionFlags = extractFlags(session.frontmatter);
  const effectiveFlags = mergeFlags(sessionFlags, cliFlags);

  console.log(chalk.dim(`Resuming base session '${name}'...`));

  try {
    await resumeSession(userData.id, name, effectiveFlags);
    console.log();
    console.log(chalk.green(`Exited base session '${name}'`));
  } catch (err) {
    const sessionError = err as SessionError;
    console.error(chalk.yellow(sessionError.message));
    if (sessionError.stderr) {
      console.error(sessionError.stderr);
    }
    process.exit(1);
  }
}
