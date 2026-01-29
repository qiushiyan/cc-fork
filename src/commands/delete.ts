import chalk from "chalk";
import {
  deleteSession,
  sessionExists,
  validateSessionName,
} from "../lib/session.js";
import { confirm } from "../lib/prompt.js";

interface DeleteOptions {
  force?: boolean;
}

export async function del(name: string, options: DeleteOptions): Promise<void> {
  try {
    validateSessionName(name);
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }

  const exists = await sessionExists(name);
  if (!exists) {
    console.error(chalk.red(`Session '${name}' not found.`));
    process.exit(1);
  }

  if (!options.force) {
    const confirmed = await confirm(`Delete session '${name}'?`);
    if (!confirmed) {
      console.log(chalk.dim("Aborted."));
      return;
    }
  }

  try {
    await deleteSession(name);
    console.log(chalk.green(`Deleted session '${name}'`));
  } catch (err) {
    console.error(chalk.red(`Failed to delete session: ${err}`));
    process.exit(1);
  }
}
