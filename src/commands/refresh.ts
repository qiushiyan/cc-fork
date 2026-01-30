import chalk from "chalk";
import ora from "ora";
import { randomUUID } from "node:crypto";
import {
  readSession,
  writeSession,
  sessionExists,
  validateSessionName,
} from "../lib/session.js";
import {
  createBaseSession,
  createBaseSessionInteractive,
} from "../lib/claude.js";
import { getSessionPath } from "../lib/config.js";
import { extractFlags, mergeFlags } from "../lib/flags.js";
import type { ClaudeFlags } from "../types.js";

export interface RefreshOptions {
  interactive?: boolean;
}

export async function refresh(
  name: string,
  cliFlags: ClaudeFlags = {},
  options: RefreshOptions = {}
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
  if (!session.content.trim()) {
    console.error(chalk.red("Session file is empty. Aborting."));
    process.exit(1);
  }

  const sessionFlags = extractFlags(session.frontmatter);
  const effectiveFlags = mergeFlags(sessionFlags, cliFlags);

  const uuid = randomUUID();
  const now = new Date().toISOString();
  const startTime = Date.now();

  const interactive = options.interactive ?? true;

  if (interactive) {
    console.log(chalk.dim(`Entering Claude Code...`));
    try {
      await createBaseSessionInteractive(uuid, session.content, effectiveFlags);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      await writeSession(
        name,
        {
          id: uuid,
          created: session.frontmatter.created || now,
          updated: now,
          ...sessionFlags,
        },
        session.content
      );
      console.log(chalk.green(`\nRefreshed base session '${name}'`));
      console.log(chalk.dim(`New session ID: ${uuid}`));
      console.log(chalk.dim(`Duration: ${duration}s`));
    } catch (err) {
      console.error(chalk.red(`Failed to refresh session: ${err}`));
      process.exit(1);
    }
  } else {
    const spinner = ora(`Refreshing base session '${name}'...`).start();
    try {
      const response = await createBaseSession(
        uuid,
        session.content,
        effectiveFlags
      );
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      await writeSession(
        name,
        {
          id: uuid,
          created: session.frontmatter.created || now,
          updated: now,
          ...sessionFlags,
        },
        session.content
      );
      spinner.succeed(`Refreshed base session '${name}'`);
      console.log(chalk.dim(`New session ID: ${uuid}`));
      console.log(chalk.dim(`Duration: ${duration}s`));

      if (response.result) {
        console.log(chalk.dim("\nClaude's response:"));
        const truncated =
          response.result.length > 500
            ? response.result.slice(0, 500) + "..."
            : response.result;
        console.log(truncated);
      }
    } catch (err) {
      spinner.fail(`Failed to refresh session`);
      console.error(chalk.red(`${err}`));
      process.exit(1);
    }
  }
}
