import chalk from "chalk";
import { listSessions } from "../lib/session.js";
import { readUserSession } from "../lib/user-storage.js";

export async function list(): Promise<void> {
  const { sessions, errors } = await listSessions();

  if (errors.length > 0) {
    console.error(
      chalk.yellow(`Warning: ${errors.length} session(s) could not be read:`)
    );
    for (const { name, error } of errors) {
      console.error(chalk.yellow(`  - ${name}: ${error}`));
    }
    console.log();
  }

  if (sessions.length === 0) {
    console.log(chalk.dim("No sessions found."));
    console.log(
      chalk.dim("Run 'cc-fork create <name>' to create your first session.")
    );
    return;
  }

  console.log(
    chalk.bold(
      padRight("NAME", 20) +
        padRight("CREATED", 22) +
        padRight("UPDATED", 22) +
        "STATUS"
    )
  );

  for (const session of sessions) {
    // Read session metadata from user storage
    const userData = await readUserSession(session.name);
    const name = padRight(session.name, 20);
    const created = padRight(formatDate(userData?.created), 22);
    const updated = padRight(formatDate(userData?.updated), 22);
    const status = userData?.id
      ? chalk.green("ready")
      : chalk.yellow("no session");

    console.log(name + created + updated + status);
  }
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
