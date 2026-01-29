import chalk from "chalk";
import ora from "ora";
import { randomUUID } from "node:crypto";
import { ensureConfigDir, readProjectConfig } from "../lib/config.js";
import {
  readSession,
  writeSession,
  sessionExists,
  getDefaultTemplate,
  validateSessionName,
} from "../lib/session.js";
import {
  createBaseSession,
  createBaseSessionInteractive,
} from "../lib/claude.js";
import { askQuestion, openEditor } from "../lib/prompt.js";
import { getSessionPath } from "../lib/config.js";
import { mergeFlags } from "../lib/flags.js";
import type { ClaudeFlags } from "../types.js";

export interface CreateOptions {
  interactive?: boolean;
}

export async function create(
  name?: string,
  cliFlags: ClaudeFlags = {},
  options: CreateOptions = {}
): Promise<void> {
  if (!name) {
    name = await askQuestion("Session name: ");
    if (!name) {
      console.error(chalk.red("Session name is required"));
      process.exit(1);
    }
  }

  try {
    validateSessionName(name);
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  await ensureConfigDir();

  const sessionPath = getSessionPath(name);
  const exists = await sessionExists(name);
  if (exists) {
    let session;
    try {
      session = await readSession(name);
    } catch (err) {
      console.error(
        chalk.red(
          `Failed to read session '${name}'. The file may be corrupted. Fix or delete: ${sessionPath}`
        )
      );
      process.exit(1);
    }
    if (session.frontmatter.id) {
      console.error(
        chalk.red(
          `Session '${name}' already exists. Use 'cc-fork refresh ${name}' to recreate.`
        )
      );
      process.exit(1);
    }
  }

  if (!exists) {
    const template = getDefaultTemplate(name);
    await writeSession(name, {}, template);
    console.log(chalk.dim(`Created ${sessionPath}`));
  }

  console.log(chalk.dim("Opening editor... Save and close when done."));
  await openEditor(sessionPath);

  let session;
  try {
    session = await readSession(name);
  } catch (err) {
    console.error(
      chalk.red(
        `Failed to read session '${name}'. The file may be corrupted. Fix or delete: ${sessionPath}`
      )
    );
    process.exit(1);
  }
  if (!session.content.trim()) {
    console.error(chalk.red("Session file is empty. Aborting."));
    process.exit(1);
  }

  const uuid = randomUUID();
  const projectConfig = await readProjectConfig();
  const effectiveFlags = mergeFlags(projectConfig, cliFlags);
  const now = new Date().toISOString();

  const startTime = Date.now();

  if (options.interactive) {
    console.log(chalk.dim(`Entering Claude Code...`));
    try {
      await createBaseSessionInteractive(uuid, session.content, effectiveFlags);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      await writeSession(
        name,
        {
          id: uuid,
          created: now,
          updated: now,
          ...effectiveFlags,
        },
        session.content
      );
      console.log(chalk.green(`\nCreated base session '${name}'`));
      console.log(chalk.dim(`Session ID: ${uuid}`));
      console.log(chalk.dim(`Duration: ${duration}s`));
    } catch (err) {
      console.error(chalk.red(`Failed to create session: ${err}`));
      process.exit(1);
    }
  } else {
    const spinner = ora(`Creating base session '${name}'...`).start();
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
          created: now,
          updated: now,
          ...effectiveFlags,
        },
        session.content
      );
      spinner.succeed(`Created base session '${name}'`);
      console.log(chalk.dim(`Session ID: ${uuid}`));
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
      spinner.fail(`Failed to create session`);
      console.error(chalk.red(`${err}`));
      process.exit(1);
    }
  }
}
