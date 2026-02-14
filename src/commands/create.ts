import chalk from "chalk";
import ora from "ora";
import { randomUUID } from "node:crypto";
import { ensureConfigDir } from "../lib/config.js";
import {
  readSession,
  writeSession,
  sessionExists,
  deleteSession,
  getDefaultTemplate,
  validateSessionName,
} from "../lib/session.js";
import {
  createBaseSession,
  createBaseSessionInteractive,
} from "../lib/claude.js";
import { askQuestion, openEditor, choose } from "../lib/prompt.js";
import { getSessionPath } from "../lib/config.js";
import {
  writeUserSession,
  computePromptHash,
  readUserSession,
  deleteUserSession,
} from "../lib/user-storage.js";
import type { ClaudeFlags } from "../types.js";

export interface CreateOptions {
  interactive?: boolean;
  prompt?: string;
  noEval?: boolean;
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
    // Check user storage for existing session ID
    const userData = await readUserSession(name);
    if (userData?.id) {
      if (!process.stdin.isTTY) {
        console.error(
          chalk.red(
            `Session '${name}' already exists. Use 'cc-fork refresh ${name}' to recreate.`
          )
        );
        process.exit(1);
      }

      const action = await choose(
        chalk.yellow(`Session '${name}' already exists.`),
        [
          { label: "Refresh - re-run prompt for new session ID", value: "refresh" },
          { label: "Edit - open session content in editor", value: "edit" },
          { label: "Delete - remove session and start over", value: "delete" },
          { label: "Exit", value: "exit" },
        ]
      );

      if (action === "refresh") {
        const { refresh } = await import("./refresh.js");
        return refresh(name, cliFlags, { interactive: options.interactive });
      }

      if (action === "edit") {
        try {
          await openEditor(sessionPath);
          console.log(chalk.dim("Editor closed."));
          console.log(
            chalk.dim(
              `Run 'cc-fork refresh ${name}' to rebuild with updated content.`
            )
          );
        } catch (err) {
          console.error(chalk.red(`Failed to open editor: ${err}`));
          process.exit(1);
        }
        return;
      }

      if (action === "delete") {
        await deleteSession(name);
        await deleteUserSession(name);
        console.log(chalk.green(`Deleted session '${name}'`));
        return;
      }

      // exit (or invalid input)
      console.log(chalk.dim("Aborted."));
      return;
    }
  }

  let sessionContent: string;

  if (options.prompt) {
    // Inline prompt: write directly, skip editor
    await writeSession(name, {}, options.prompt);
    sessionContent = options.prompt;
  } else {
    // Editor flow
    if (!exists) {
      const template = getDefaultTemplate(name);
      await writeSession(name, {}, template);
      console.log(chalk.dim(`Created ${sessionPath}`));
    }

    console.log(chalk.dim("Opening editor... Save and close when done."));
    try {
      await openEditor(sessionPath);
    } catch (err) {
      console.error(chalk.red(`Failed to open editor: ${err}`));
      console.error(
        chalk.dim(`You can edit the file manually at: ${sessionPath}`)
      );
      process.exit(1);
    }

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
    sessionContent = session.content;
  }

  if (options.noEval) {
    console.log(chalk.green(`Created session file '${name}'`));
    console.log(
      chalk.dim(
        `Run 'cc-fork refresh ${name}' to evaluate the prompt and start a session.`
      )
    );
    return;
  }

  const uuid = randomUUID();
  const effectiveFlags = cliFlags;
  const now = new Date().toISOString();

  const startTime = Date.now();

  const interactive = options.interactive ?? true;

  if (interactive) {
    console.log(chalk.dim(`Entering Claude Code...`));
    try {
      await createBaseSessionInteractive(uuid, sessionContent, effectiveFlags);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      // Write only flags to frontmatter (no id/timestamps)
      await writeSession(name, effectiveFlags, sessionContent);
      // Write session metadata to user storage
      await writeUserSession(name, {
        id: uuid,
        created: now,
        updated: now,
        promptHash: computePromptHash(sessionContent),
      });
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
        sessionContent,
        effectiveFlags
      );
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      // Write only flags to frontmatter (no id/timestamps)
      await writeSession(name, effectiveFlags, sessionContent);
      // Write session metadata to user storage
      await writeUserSession(name, {
        id: uuid,
        created: now,
        updated: now,
        promptHash: computePromptHash(sessionContent),
      });
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
