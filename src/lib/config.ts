import { mkdir, readFile, stat, rename, cp, rm } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { CcForkConfig } from "../types.js";
import { confirm } from "./prompt.js";

const CONFIG_DIR_NAME = ".cc-fork";
const LEGACY_CONFIG_DIR_NAME = ".claude/cc-fork";
const CONFIG_FILE_NAME = "config.yaml";
const KNOWN_CONFIG_KEYS = new Set(["interactive", "defaultCommand", "projectId"]);

async function dirExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

export async function checkLegacyConfigDir(basePath?: string): Promise<void> {
  const base = basePath ?? process.cwd();
  const legacyDir = join(base, LEGACY_CONFIG_DIR_NAME);
  const newDir = join(base, CONFIG_DIR_NAME);

  const [legacyExists, newExists] = await Promise.all([
    dirExists(legacyDir),
    dirExists(newDir),
  ]);

  if (!legacyExists) return;

  if (legacyExists && newExists) {
    console.error(
      `Both '${LEGACY_CONFIG_DIR_NAME}/' and '${CONFIG_DIR_NAME}/' exist. Please resolve manually.`
    );
    process.exit(1);
  }

  console.log(
    `Detected legacy config directory at '${LEGACY_CONFIG_DIR_NAME}/'. cc-fork now uses '${CONFIG_DIR_NAME}/' at the project root.`
  );

  const accepted = await confirm("Move configuration to '.cc-fork/'?");

  if (!accepted) {
    console.log(
      "Migration declined. cc-fork requires '.cc-fork/' at the project root. Move the directory manually or re-run to accept."
    );
    process.exit(1);
  }

  try {
    await rename(legacyDir, newDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      const tmpDir = join(base, ".cc-fork.tmp");
      await cp(legacyDir, tmpDir, { recursive: true });
      await rename(tmpDir, newDir);
      await rm(legacyDir, { recursive: true, force: true });
    } else {
      throw err;
    }
  }

  console.log("Migrated to '.cc-fork/'.");
}

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
