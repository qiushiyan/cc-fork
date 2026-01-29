import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestDir, cleanupTestDir, createMockSessionFile } from "./utils.js";
import { ensureConfigDir } from "../src/lib/config.js";
import {
  listSessions,
  deleteSession,
  sessionExists,
  validateSessionName,
} from "../src/lib/session.js";

describe("list command", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    await ensureConfigDir(testDir);
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  describe("listSessions", () => {
    it("should return empty sessions array when no sessions exist", async () => {
      const result = await listSessions(testDir);

      expect(result.sessions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should return sessions sorted by name with valid session files", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "alpha-session", "Alpha content", {
        id: "session-1",
        created: "2024-01-01T10:00:00Z",
        updated: "2024-01-02T10:00:00Z",
      });

      await createMockSessionFile(configDir, "beta-session", "Beta content", {
        id: "session-2",
        created: "2024-01-03T10:00:00Z",
        updated: "2024-01-04T10:00:00Z",
      });

      const result = await listSessions(testDir);

      expect(result.sessions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      const alphaSession = result.sessions.find((s) => s.name === "alpha-session");
      expect(alphaSession).toBeDefined();
      expect(alphaSession?.frontmatter.id).toBe("session-1");
      expect(alphaSession?.frontmatter.created).toBe("2024-01-01T10:00:00Z");
      expect(alphaSession?.frontmatter.updated).toBe("2024-01-02T10:00:00Z");
      expect(alphaSession?.content).toBe("Alpha content\n");

      const betaSession = result.sessions.find((s) => s.name === "beta-session");
      expect(betaSession).toBeDefined();
      expect(betaSession?.frontmatter.id).toBe("session-2");
    });

    it("should return session without id when frontmatter is incomplete", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "no-id-session", "Content without ID", {
        created: "2024-01-01T10:00:00Z",
      });

      const result = await listSessions(testDir);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]!.name).toBe("no-id-session");
      expect(result.sessions[0]!.frontmatter.id).toBeUndefined();
    });

    it("should return empty result when config directory does not exist", async () => {
      const nonExistentDir = `${testDir}/non-existent`;

      const result = await listSessions(nonExistentDir);

      expect(result.sessions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should ignore non-markdown files", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;
      const { writeFile } = await import("node:fs/promises");

      await createMockSessionFile(configDir, "valid-session", "Valid content", {
        id: "session-1",
      });

      await writeFile(`${configDir}/notes.txt`, "Some notes");
      await writeFile(`${configDir}/config.json`, '{"key": "value"}');

      const result = await listSessions(testDir);

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]!.name).toBe("valid-session");
    });
  });
});

describe("delete command", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    await ensureConfigDir(testDir);
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  describe("validateSessionName", () => {
    it("should accept valid session names", () => {
      expect(() => validateSessionName("my-session")).not.toThrow();
      expect(() => validateSessionName("my_session")).not.toThrow();
      expect(() => validateSessionName("mySession123")).not.toThrow();
      expect(() => validateSessionName("SESSION")).not.toThrow();
      expect(() => validateSessionName("a")).not.toThrow();
      expect(() => validateSessionName("123")).not.toThrow();
    });

    it("should reject empty session name", () => {
      expect(() => validateSessionName("")).toThrow("Session name is required");
    });

    it("should reject session names with invalid characters", () => {
      expect(() => validateSessionName("my session")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
      expect(() => validateSessionName("my.session")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
      expect(() => validateSessionName("my/session")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
      expect(() => validateSessionName("my@session")).toThrow(
        "Session name can only contain letters, numbers, hyphens, and underscores"
      );
    });
  });

  describe("sessionExists", () => {
    it("should return true when session file exists", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "existing-session", "Content", {
        id: "session-1",
      });

      const exists = await sessionExists("existing-session", testDir);

      expect(exists).toBe(true);
    });

    it("should return false when session file does not exist", async () => {
      const exists = await sessionExists("non-existent-session", testDir);

      expect(exists).toBe(false);
    });
  });

  describe("deleteSession", () => {
    it("should delete an existing session file", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "to-delete", "Content to delete", {
        id: "session-1",
      });

      expect(await sessionExists("to-delete", testDir)).toBe(true);

      await deleteSession("to-delete", testDir);

      expect(await sessionExists("to-delete", testDir)).toBe(false);
    });

    it("should throw error when deleting non-existent session", async () => {
      await expect(deleteSession("non-existent", testDir)).rejects.toThrow();
    });

    it("should only delete the specified session", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "keep-this", "Keep this content", {
        id: "session-1",
      });

      await createMockSessionFile(configDir, "delete-this", "Delete this content", {
        id: "session-2",
      });

      await deleteSession("delete-this", testDir);

      expect(await sessionExists("keep-this", testDir)).toBe(true);
      expect(await sessionExists("delete-this", testDir)).toBe(false);
    });
  });
});

describe("command output formatting", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    await ensureConfigDir(testDir);
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  describe("list command output data", () => {
    it("should provide session data suitable for table display", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "my-project", "Project notes", {
        id: "abc123",
        created: "2024-06-15T09:30:00Z",
        updated: "2024-06-16T14:45:00Z",
      });

      const result = await listSessions(testDir);

      expect(result.sessions).toHaveLength(1);
      const session = result.sessions[0]!;

      expect(session.name).toBe("my-project");
      expect(session.frontmatter.id).toBe("abc123");
      expect(session.frontmatter.created).toBe("2024-06-15T09:30:00Z");
      expect(session.frontmatter.updated).toBe("2024-06-16T14:45:00Z");
    });

    it("should indicate ready status when session has id", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "ready-session", "Content", {
        id: "session-id",
      });

      const result = await listSessions(testDir);
      const session = result.sessions[0]!;

      expect(session.frontmatter.id).toBeDefined();
      expect(session.frontmatter.id).toBe("session-id");
    });

    it("should indicate no-session status when session lacks id", async () => {
      const configDir = `${testDir}/.claude/cc-fork`;

      await createMockSessionFile(configDir, "not-ready-session", "Content", {
        created: "2024-06-15T09:30:00Z",
      });

      const result = await listSessions(testDir);
      const session = result.sessions[0]!;

      expect(session.frontmatter.id).toBeUndefined();
    });
  });
});
