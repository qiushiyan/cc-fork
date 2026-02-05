import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { getGitRemoteOrigin, normalizeGitUrl, extractRepoName } from "./git.js";
import { readProjectConfig } from "./config.js";

export interface UserSessionData {
  id: string;
  created: string;
  updated: string;
  promptHash?: string;
}

const USER_STORAGE_DIR = ".cc-fork";

// Cache project ID per process to avoid redundant git calls
let cachedProjectId: string | null = null;
let cachedBasePath: string | null = null;

/**
 * Get the user-level storage directory (~/.cc-fork).
 */
export function getUserStorageDir(): string {
  return join(homedir(), USER_STORAGE_DIR);
}

/**
 * Create a short hash from a string.
 */
function createShortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 8);
}

/**
 * Derive project ID from git remote URL.
 */
function deriveProjectIdFromRemote(url: string): string {
  const normalized = normalizeGitUrl(url);
  const repoName = extractRepoName(normalized);
  const hash = createShortHash(normalized);
  return `${repoName}-${hash}`;
}

/**
 * Derive project ID from absolute path.
 */
function deriveProjectIdFromPath(path: string): string {
  const dirName = basename(path);
  const hash = createShortHash(path);
  return `${dirName}-${hash}`;
}

/**
 * Sanitize a project ID to prevent path traversal attacks.
 * Removes path separators, .., and other unsafe characters.
 */
function sanitizeProjectId(id: string): string {
  // Replace path separators and unsafe patterns
  return id
    .replace(/\.\./g, "")           // Remove ..
    .replace(/[/\\]/g, "-")         // Replace path separators with -
    .replace(/[<>:"|?*]/g, "")      // Remove Windows-unsafe chars
    .replace(/^\.+/, "")            // Remove leading dots
    .replace(/\.+$/, "")            // Remove trailing dots
    .replace(/-+/g, "-")            // Collapse multiple dashes
    .replace(/^-+|-+$/g, "")        // Trim leading/trailing dashes
    || "project";                   // Fallback if empty
}

/**
 * Get the project ID for the current directory.
 * Priority: config.yaml projectId > git remote > path hash
 * Result is cached per process.
 */
export async function getProjectId(basePath?: string): Promise<string> {
  const cwd = basePath ?? process.cwd();

  // Return cached value if same basePath
  if (cachedProjectId && cachedBasePath === cwd) {
    return cachedProjectId;
  }

  // 1. Check config.yaml for explicit projectId
  const config = await readProjectConfig(basePath);
  if (config.projectId) {
    cachedProjectId = sanitizeProjectId(config.projectId);
    cachedBasePath = cwd;
    return cachedProjectId;
  }

  // 2. Try git remote origin
  const remoteUrl = await getGitRemoteOrigin(cwd);
  if (remoteUrl) {
    cachedProjectId = deriveProjectIdFromRemote(remoteUrl);
    cachedBasePath = cwd;
    return cachedProjectId;
  }

  // 3. Fallback to path hash
  cachedProjectId = deriveProjectIdFromPath(cwd);
  cachedBasePath = cwd;
  return cachedProjectId;
}

/**
 * Get the project-specific storage directory.
 */
export async function getProjectStorageDir(basePath?: string): Promise<string> {
  const projectId = await getProjectId(basePath);
  return join(getUserStorageDir(), projectId);
}

/**
 * Get the path to a user session file.
 */
export async function getUserSessionPath(
  name: string,
  basePath?: string
): Promise<string> {
  const projectDir = await getProjectStorageDir(basePath);
  return join(projectDir, `${name}.json`);
}

/**
 * Ensure the project storage directory exists.
 */
async function ensureProjectStorageDir(basePath?: string): Promise<string> {
  const dir = await getProjectStorageDir(basePath);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Read user session data from storage.
 * Returns null if not found or if the file is corrupted.
 */
export async function readUserSession(
  name: string,
  basePath?: string
): Promise<UserSessionData | null> {
  const path = await getUserSessionPath(name, basePath);
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as UserSessionData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Handle corrupted JSON gracefully
    if (err instanceof SyntaxError) {
      console.warn(
        `Warning: Corrupted session data at ${path}. Run 'cc-fork refresh' to fix.`
      );
      return null;
    }
    throw err;
  }
}

/**
 * Write user session data to storage.
 */
export async function writeUserSession(
  name: string,
  data: UserSessionData,
  basePath?: string
): Promise<void> {
  await ensureProjectStorageDir(basePath);
  const path = await getUserSessionPath(name, basePath);
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Delete user session data from storage.
 * Silently succeeds if file doesn't exist.
 */
export async function deleteUserSession(
  name: string,
  basePath?: string
): Promise<void> {
  const path = await getUserSessionPath(name, basePath);
  try {
    await unlink(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

/**
 * Check if user session data exists.
 */
export async function userSessionExists(
  name: string,
  basePath?: string
): Promise<boolean> {
  const data = await readUserSession(name, basePath);
  return data !== null;
}

/**
 * Compute a hash of prompt content for staleness detection.
 */
export function computePromptHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Clear the cached project ID (useful for testing).
 */
export function clearProjectIdCache(): void {
  cachedProjectId = null;
  cachedBasePath = null;
}
