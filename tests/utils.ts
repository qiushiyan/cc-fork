import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";

/**
 * Helper to create a temporary test directory.
 * Creates a unique directory in os.tmpdir() with prefix 'cc-fork-test-'.
 */
export async function createTestDir(): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const dirName = `cc-fork-test-${timestamp}-${random}`;
  const dirPath = join(tmpdir(), dirName);

  await mkdir(dirPath, { recursive: true });

  return dirPath;
}

/**
 * Helper to clean up a temporary test directory.
 * Recursively removes the directory and all its contents.
 */
export async function cleanupTestDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Helper to create a mock session file in a directory.
 * Uses gray-matter to create a markdown file with YAML frontmatter.
 *
 * @param baseDir - The base directory where the file will be created
 * @param name - The filename (without extension)
 * @param content - The markdown content body
 * @param frontmatter - Optional frontmatter fields (id, created, updated)
 * @returns The full path to the created file
 */
export async function createMockSessionFile(
  baseDir: string,
  name: string,
  content: string,
  frontmatter?: { id?: string; created?: string; updated?: string }
): Promise<string> {
  const filePath = join(baseDir, `${name}.md`);

  const data: Record<string, string> = {};
  if (frontmatter?.id) {
    data.id = frontmatter.id;
  }
  if (frontmatter?.created) {
    data.created = frontmatter.created;
  }
  if (frontmatter?.updated) {
    data.updated = frontmatter.updated;
  }

  const fileContent = matter.stringify(content, data);

  await writeFile(filePath, fileContent, "utf-8");

  return filePath;
}
