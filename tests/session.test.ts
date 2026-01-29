import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  validateSessionName,
  readSession,
  writeSession,
  listSessions,
  sessionExists,
  deleteSession,
} from "../src/lib/session.js";
import { createTestDir, cleanupTestDir, createMockSessionFile } from "./utils.js";

describe("validateSessionName", () => {
  describe("valid names", () => {
    it("accepts alphanumeric with hyphens", () => {
      expect(() => validateSessionName("my-session")).not.toThrow();
    });

    it("accepts alphanumeric with underscores", () => {
      expect(() => validateSessionName("test_123")).not.toThrow();
    });

    it("accepts mixed case alphanumeric", () => {
      expect(() => validateSessionName("Session1")).not.toThrow();
    });

    it("accepts simple alphanumeric", () => {
      expect(() => validateSessionName("session")).not.toThrow();
    });

    it("accepts numbers only", () => {
      expect(() => validateSessionName("123")).not.toThrow();
    });
  });

  describe("invalid names", () => {
    it("rejects empty string", () => {
      expect(() => validateSessionName("")).toThrow("Session name is required");
    });

    it("rejects path traversal", () => {
      expect(() => validateSessionName("../path")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("rejects names with spaces", () => {
      expect(() => validateSessionName("has spaces")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("rejects names with dots", () => {
      expect(() => validateSessionName("has.dot")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("rejects names with special characters", () => {
      expect(() => validateSessionName("special@char")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("rejects names with slashes", () => {
      expect(() => validateSessionName("path/name")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
    });
  });
});

describe("readSession", () => {
  let testDir: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    configDir = join(testDir, ".claude", "cc-fork");
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("reads existing session with frontmatter", async () => {
    await createMockSessionFile(configDir, "my-session", "# Test Content\n\nSome body text", {
      id: "abc123",
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    });

    const session = await readSession("my-session", testDir);

    expect(session.name).toBe("my-session");
    expect(session.path).toBe(join(configDir, "my-session.md"));
    expect(session.frontmatter.id).toBe("abc123");
    expect(session.frontmatter.created).toBe("2024-01-01T00:00:00Z");
    expect(session.frontmatter.updated).toBe("2024-01-02T00:00:00Z");
    expect(session.content).toBe("# Test Content\n\nSome body text\n");
  });

  it("reads session without id in frontmatter", async () => {
    await createMockSessionFile(configDir, "no-id-session", "Content without id", {
      created: "2024-01-01T00:00:00Z",
    });

    const session = await readSession("no-id-session", testDir);

    expect(session.name).toBe("no-id-session");
    expect(session.frontmatter.id).toBeUndefined();
    expect(session.frontmatter.created).toBe("2024-01-01T00:00:00Z");
    expect(session.content).toBe("Content without id\n");
  });

  it("reads session with empty frontmatter", async () => {
    await createMockSessionFile(configDir, "empty-frontmatter", "Just content");

    const session = await readSession("empty-frontmatter", testDir);

    expect(session.name).toBe("empty-frontmatter");
    expect(session.frontmatter.id).toBeUndefined();
    expect(session.frontmatter.created).toBeUndefined();
    expect(session.content).toBe("Just content\n");
  });

  it("throws when reading non-existent session", async () => {
    await expect(readSession("nonexistent", testDir)).rejects.toThrow();
  });
});

describe("writeSession", () => {
  let testDir: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    configDir = join(testDir, ".claude", "cc-fork");
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("writes new session with frontmatter and content", async () => {
    const frontmatter = {
      id: "new-id-123",
      created: "2024-03-01T00:00:00Z",
      updated: "2024-03-01T00:00:00Z",
    };
    const content = "# New Session\n\nThis is new content.";

    await writeSession("new-session", frontmatter, content, testDir);

    const session = await readSession("new-session", testDir);
    expect(session.frontmatter.id).toBe("new-id-123");
    expect(session.frontmatter.created).toBe("2024-03-01T00:00:00Z");
    expect(session.frontmatter.updated).toBe("2024-03-01T00:00:00Z");
    expect(session.content).toBe("# New Session\n\nThis is new content.\n");
  });

  it("overwrites existing session", async () => {
    await createMockSessionFile(configDir, "overwrite-test", "Original content", {
      id: "original-id",
      created: "2024-01-01T00:00:00Z",
    });

    const newFrontmatter = {
      id: "new-id",
      created: "2024-01-01T00:00:00Z",
      updated: "2024-02-01T00:00:00Z",
    };
    await writeSession("overwrite-test", newFrontmatter, "Updated content", testDir);

    const session = await readSession("overwrite-test", testDir);
    expect(session.frontmatter.id).toBe("new-id");
    expect(session.frontmatter.updated).toBe("2024-02-01T00:00:00Z");
    expect(session.content).toBe("Updated content\n");
  });

  it("writes session with empty frontmatter", async () => {
    await writeSession("empty-fm", {}, "Content only", testDir);

    const session = await readSession("empty-fm", testDir);
    expect(session.frontmatter.id).toBeUndefined();
    expect(session.content).toBe("Content only\n");
  });

  it("writes session with multiline content", async () => {
    const content = `# Title

## Section 1

Some paragraph text.

## Section 2

- Item 1
- Item 2
- Item 3`;

    await writeSession("multiline", { id: "ml-123" }, content, testDir);

    const session = await readSession("multiline", testDir);
    expect(session.content).toBe(`${content}\n`);
  });
});

describe("listSessions", () => {
  let testDir: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    configDir = join(testDir, ".claude", "cc-fork");
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("returns empty sessions array for empty directory", async () => {
    const result = await listSessions(testDir);

    expect(result.sessions).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("lists valid sessions in directory", async () => {
    await createMockSessionFile(configDir, "session-one", "Content 1", {
      id: "id-1",
      created: "2024-01-01T00:00:00Z",
    });
    await createMockSessionFile(configDir, "session-two", "Content 2", {
      id: "id-2",
      created: "2024-01-02T00:00:00Z",
    });

    const result = await listSessions(testDir);

    expect(result.sessions).toHaveLength(2);
    expect(result.errors).toEqual([]);

    const names = result.sessions.map((s) => s.name).sort();
    expect(names).toEqual(["session-one", "session-two"]);
  });

  it("populates errors array for corrupted files", async () => {
    await createMockSessionFile(configDir, "valid-session", "Valid content", {
      id: "valid-id",
    });

    const corruptedPath = join(configDir, "corrupted.md");
    await writeFile(corruptedPath, "---\ninvalid: yaml: syntax:\n---\nContent", "utf-8");

    const result = await listSessions(testDir);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]!.name).toBe("valid-session");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.name).toBe("corrupted");
    expect(result.errors[0]!.error).toBeTruthy();
  });

  it("returns empty result for non-existent directory (no throw)", async () => {
    const nonExistentPath = join(testDir, "does-not-exist");

    const result = await listSessions(nonExistentPath);

    expect(result.sessions).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("ignores non-md files", async () => {
    await createMockSessionFile(configDir, "valid-session", "Content", { id: "id-1" });

    await writeFile(join(configDir, "readme.txt"), "Not a session", "utf-8");
    await writeFile(join(configDir, "config.json"), '{"key": "value"}', "utf-8");

    const result = await listSessions(testDir);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]!.name).toBe("valid-session");
    expect(result.errors).toEqual([]);
  });
});

describe("sessionExists", () => {
  let testDir: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    configDir = join(testDir, ".claude", "cc-fork");
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("returns true for existing session", async () => {
    await createMockSessionFile(configDir, "existing-session", "Content", {
      id: "exist-id",
    });

    const exists = await sessionExists("existing-session", testDir);

    expect(exists).toBe(true);
  });

  it("returns false for non-existing session", async () => {
    const exists = await sessionExists("nonexistent-session", testDir);

    expect(exists).toBe(false);
  });

  it("returns false when config directory does not exist", async () => {
    const emptyDir = await createTestDir();

    try {
      const exists = await sessionExists("any-session", emptyDir);
      expect(exists).toBe(false);
    } finally {
      await cleanupTestDir(emptyDir);
    }
  });
});

describe("deleteSession", () => {
  let testDir: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    configDir = join(testDir, ".claude", "cc-fork");
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("deletes existing session", async () => {
    await createMockSessionFile(configDir, "to-delete", "Content to delete", {
      id: "delete-id",
    });

    expect(await sessionExists("to-delete", testDir)).toBe(true);

    await deleteSession("to-delete", testDir);

    expect(await sessionExists("to-delete", testDir)).toBe(false);
  });

  it("throws when deleting non-existent session", async () => {
    await expect(deleteSession("nonexistent", testDir)).rejects.toThrow();
  });

  it("throws with ENOENT error for non-existent session", async () => {
    try {
      await deleteSession("nonexistent", testDir);
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
    }
  });
});
