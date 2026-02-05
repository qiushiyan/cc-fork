import chalk from "chalk";
import {
  deleteSession,
  sessionExists,
  validateSessionName,
} from "../lib/session.js";
import { confirm } from "../lib/prompt.js";
import { deleteUserSession } from "../lib/user-storage.js";

interface DeleteOptions {
  force?: boolean;
}

export async function del(
  names: string[],
  options: DeleteOptions
): Promise<void> {
  const validNames: string[] = [];
  let hadErrors = false;

  // Phase 1: Validate and check existence
  for (const name of names) {
    try {
      validateSessionName(name);
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      hadErrors = true;
      continue;
    }

    const exists = await sessionExists(name);
    if (!exists) {
      if (options.force) {
        // Still try to clean up user storage even if markdown is missing
        await deleteUserSession(name);
        console.warn(chalk.yellow(`Session '${name}' not found, skipping.`));
      } else {
        console.error(chalk.red(`Session '${name}' not found.`));
        hadErrors = true;
      }
      continue;
    }

    validNames.push(name);
  }

  if (validNames.length === 0) {
    if (hadErrors) {
      process.exit(1);
    }
    return;
  }

  // Phase 2: Confirm
  if (!options.force) {
    const sessionList = validNames.map((n) => `'${n}'`).join(", ");
    const message =
      validNames.length === 1
        ? `Delete session ${sessionList}?`
        : `Delete ${validNames.length} sessions: ${sessionList}?`;
    const confirmed = await confirm(message);
    if (!confirmed) {
      console.log(chalk.dim("Aborted."));
      return;
    }
  }

  // Phase 3: Delete
  for (const name of validNames) {
    try {
      await deleteSession(name);
      await deleteUserSession(name);
      console.log(chalk.green(`Deleted session '${name}'`));
    } catch (err) {
      console.error(chalk.red(`Failed to delete session '${name}': ${err}`));
      hadErrors = true;
    }
  }

  if (hadErrors) {
    process.exit(1);
  }
}
