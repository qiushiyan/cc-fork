import { readFile, writeFile, readdir, unlink, access } from "node:fs/promises";
import { basename } from "node:path";
import matter from "gray-matter";
import { getConfigDir, getSessionPath } from "./config.js";
import type { Session, SessionFrontmatter } from "../types.js";

const SESSION_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateSessionName(name: string): void {
  if (!name) {
    throw new Error("Session name is required");
  }
  if (!SESSION_NAME_REGEX.test(name)) {
    throw new Error(
      "Session name can only contain letters, numbers, hyphens, and underscores"
    );
  }
}

export interface ListSessionsResult {
  sessions: Session[];
  errors: Array<{ name: string; error: string }>;
}

export async function readSession(name: string, basePath?: string): Promise<Session> {
  const path = getSessionPath(name, basePath);
  const raw = await readFile(path, "utf-8");
  const { data, content } = matter(raw);

  return {
    name,
    path,
    frontmatter: data as SessionFrontmatter,
    content,
  };
}

export async function writeSession(
  name: string,
  frontmatter: SessionFrontmatter,
  content: string,
  basePath?: string
): Promise<void> {
  const path = getSessionPath(name, basePath);
  // gray-matter.stringify adds a newline after the closing ---, so strip any
  // leading newline from content to avoid a double blank line.
  const trimmedContent = content.startsWith("\n") ? content.slice(1) : content;
  const output = matter.stringify(trimmedContent, frontmatter);
  await writeFile(path, output, "utf-8");
}

export async function listSessions(basePath?: string): Promise<ListSessionsResult> {
  const dir = getConfigDir(basePath);
  const result: ListSessionsResult = { sessions: [], errors: [] };

  let files: string[];
  try {
    files = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return result;
    }
    throw err;
  }

  const mdFiles = files.filter((f) => f.endsWith(".md"));

  for (const file of mdFiles) {
    const name = basename(file, ".md");
    try {
      const session = await readSession(name, basePath);
      result.sessions.push(session);
    } catch (err) {
      result.errors.push({ name, error: (err as Error).message });
    }
  }

  return result;
}

export async function sessionExists(name: string, basePath?: string): Promise<boolean> {
  const path = getSessionPath(name, basePath);
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function deleteSession(name: string, basePath?: string): Promise<void> {
  const path = getSessionPath(name, basePath);
  await unlink(path);
}

export function getDefaultTemplate(name: string): string {
  return `# ${name}

## Files to Read

List the files Claude should read to understand the context:

1. \`docs/README.md\` - Project overview
2. \`src/main.ts\` - Entry point

## Key Concepts

Describe what Claude should focus on understanding:

- How the authentication flow works
- The data model structure

## Summary Request

After reading, ask Claude to summarize:

- Main components and their responsibilities
- Key patterns used in the codebase
`;
}
