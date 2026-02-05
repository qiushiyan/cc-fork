import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Get the git remote origin URL for a directory.
 * Returns null if not a git repo or no origin remote.
 */
export async function getGitRemoteOrigin(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git remote get-url origin", { cwd });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Normalize a git URL to a canonical form for hashing.
 * Strips protocol, credentials, .git suffix, and lowercases host.
 *
 * Examples:
 *   git@github.com:org/repo.git           → github.com/org/repo
 *   https://github.com/org/repo.git       → github.com/org/repo
 *   https://token@github.com/org/repo.git → github.com/org/repo
 *   ssh://git@github.com/org/repo         → github.com/org/repo
 */
export function normalizeGitUrl(url: string): string {
  let normalized = url.trim();

  // Handle SSH format: git@host:path → host/path
  const sshMatch = normalized.match(/^(?:[\w-]+@)?([^:]+):(.+)$/);
  if (sshMatch && !normalized.includes("://")) {
    normalized = `${sshMatch[1]}/${sshMatch[2]}`;
  } else {
    // Strip protocol (https://, ssh://, git://)
    normalized = normalized.replace(/^[a-z+]+:\/\//, "");
    // Strip userinfo (credentials, tokens)
    normalized = normalized.replace(/^[^@]+@/, "");
  }

  // Strip .git suffix
  normalized = normalized.replace(/\.git$/, "");
  // Strip trailing slashes
  normalized = normalized.replace(/\/+$/, "");

  // Lowercase the host (first segment before /)
  const slashIndex = normalized.indexOf("/");
  if (slashIndex > 0) {
    const host = normalized.slice(0, slashIndex).toLowerCase();
    const path = normalized.slice(slashIndex);
    normalized = host + path;
  } else {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Extract the repository name from a normalized git URL.
 * Returns the last path segment.
 */
export function extractRepoName(normalizedUrl: string): string {
  const parts = normalizedUrl.split("/");
  return parts[parts.length - 1] || "unknown";
}
