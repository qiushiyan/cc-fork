#!/usr/bin/env node
declare const PKG_VERSION: string;
import { program, type Command } from "commander";
import { create } from "./commands/create.js";
import { fork } from "./commands/fork.js";
import { use } from "./commands/use.js";
import { refresh } from "./commands/refresh.js";
import { list } from "./commands/list.js";
import { del } from "./commands/delete.js";
import { edit } from "./commands/edit.js";
import { parseCliArgs } from "./lib/flags.js";
import { readProjectConfig } from "./lib/config.js";

const knownCommands = new Set([
  "create",
  "new",
  "fork",
  "use",
  "refresh",
  "rebuild",
  "list",
  "delete",
  "edit",
  "help",
]);

async function main() {
  const config = await readProjectConfig();
  const defaultCmd = config.defaultCommand || "fork";

  // Default to configured command if first arg isn't a known command
  const args = process.argv.slice(2);
  const firstArg = args[0];
  if (firstArg && !firstArg.startsWith("-") && !knownCommands.has(firstArg)) {
    process.argv.splice(2, 0, defaultCmd);
  }

  program
    .name("cc-fork")
    .description("Claude Code kickstart session manager")
    .version(PKG_VERSION, "-v, --version");

  program
    .command("create [name]")
    .alias("new")
    .description("Create a new base session")
    .option("-i, --interactive", "Enter Claude Code after sending prompt")
    .option("-p, --prompt <text>", "Provide prompt inline (skip editor)")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(
      (
        name: string | undefined,
        options: { interactive?: boolean; prompt?: string },
        command: Command
      ) => {
        const rawArgs = command.args.slice(name ? 1 : 0);
        const cliFlags = parseCliArgs(rawArgs);
        return create(name, cliFlags, {
          interactive: options.interactive ?? config.interactive,
          prompt: options.prompt,
        });
      }
    );

  program
    .command("fork <name>")
    .description("Fork from a base session for daily work")
    .allowUnknownOption()
    .allowExcessArguments()
    .action((name: string, _options: unknown, command: Command) => {
      const rawArgs = command.args.slice(1);
      const cliFlags = parseCliArgs(rawArgs);
      return fork(name, cliFlags);
    });

  program
    .command("use <name>")
    .description("Resume a base session to add more context")
    .allowUnknownOption()
    .allowExcessArguments()
    .action((name: string, _options: unknown, command: Command) => {
      const rawArgs = command.args.slice(1);
      const cliFlags = parseCliArgs(rawArgs);
      return use(name, cliFlags);
    });

  program
    .command("refresh <name>")
    .alias("rebuild")
    .description("Recreate base session with current prompt")
    .option("-i, --interactive", "Enter Claude Code after sending prompt")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(
      (name: string, options: { interactive?: boolean }, command: Command) => {
        const rawArgs = command.args.slice(1);
        const cliFlags = parseCliArgs(rawArgs);
        return refresh(name, cliFlags, {
          interactive: options.interactive ?? config.interactive,
        });
      }
    );

  program
    .command("list")
    .description("List all base sessions")
    .action(list);

  program
    .command("delete <names...>")
    .description("Delete one or more sessions")
    .option("-f, --force", "Skip confirmation")
    .action(del);

  program
    .command("edit <name>")
    .description("Open session file in editor")
    .action(edit);

  await program.parseAsync();
}

main();
