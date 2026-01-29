import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { ClaudeFlags } from "../types.js";

const CONFIG_DIR_NAME = ".claude/cc-fork";
const CONFIG_FILE_NAME = "config.yaml";

export function getConfigDir(basePath?: string): string {
  return join(basePath ?? process.cwd(), CONFIG_DIR_NAME);
}

export async function ensureConfigDir(basePath?: string): Promise<string> {
  const dir = getConfigDir(basePath);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function getSessionPath(name: string, basePath?: string): string {
  return join(getConfigDir(basePath), `${name}.md`);
}

export function getProjectConfigPath(basePath?: string): string {
  return join(getConfigDir(basePath), CONFIG_FILE_NAME);
}

/** Read project config or return {} when missing. */
export async function readProjectConfig(
  basePath?: string
): Promise<ClaudeFlags> {
  const configPath = getProjectConfigPath(basePath);
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = matter(`---\n${content}\n---`);
    return parsed.data as ClaudeFlags;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw err;
  }
}
