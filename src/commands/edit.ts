import chalk from "chalk";
import { sessionExists, validateSessionName } from "../lib/session.js";
import { getSessionPath } from "../lib/config.js";
import { openEditor } from "../lib/prompt.js";

export async function edit(name: string): Promise<void> {
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

  const sessionPath = getSessionPath(name);
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
}
