import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { CcForkConfig } from "../types.js";

const CONFIG_DIR_NAME = ".claude/cc-fork";
const CONFIG_FILE_NAME = "config.yaml";
const KNOWN_CONFIG_KEYS = new Set(["interactive", "defaultCommand"]);

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
): Promise<CcForkConfig> {
  const configPath = getProjectConfigPath(basePath);
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = matter(`---\n${content}\n---`);
    const config: CcForkConfig = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (KNOWN_CONFIG_KEYS.has(key)) {
        (config as Record<string, unknown>)[key] = value;
      }
    }
    return config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw err;
  }
}
