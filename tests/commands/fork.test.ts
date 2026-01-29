import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fork } from "../../src/commands/fork.js";
vi.mock("../../src/lib/session.js", () => ({
  validateSessionName: vi.fn(),
  sessionExists: vi.fn(),
  readSession: vi.fn(),
}));

vi.mock("../../src/lib/claude.js", () => ({
  forkSession: vi.fn(),
}));

vi.mock("../../src/lib/config.js", () => ({
  readProjectConfig: vi.fn(),
  getSessionPath: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import {
  validateSessionName,
  sessionExists,
  readSession,
} from "../../src/lib/session.js";
import { forkSession } from "../../src/lib/claude.js";
import { getSessionPath, readProjectConfig } from "../../src/lib/config.js";

describe("fork command - flag passthrough", () => {
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(true);
    vi.mocked(forkSession).mockResolvedValue();
    vi.mocked(getSessionPath).mockReturnValue(".claude/cc-fork/test-session.md");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes flags from session frontmatter to claude", async () => {
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: ".claude/cc-fork/test-session.md",
      frontmatter: {
        id: "test-uuid",
        created: "2024-01-01",
        updated: "2024-01-01",
        model: "haiku",
        "dangerously-skip-permissions": true,
      },
      content: "test prompt",
    });
    vi.mocked(readProjectConfig).mockResolvedValue({});

    await fork("test-session", {});

    expect(forkSession).toHaveBeenCalledWith("test-uuid", "test-session", {
      model: "haiku",
      "dangerously-skip-permissions": true,
    });
  });

  it("exits with error if session file cannot be read", async () => {
    vi.mocked(readSession).mockRejectedValue(new Error("bad frontmatter"));

    await expect(fork("test-session", {})).rejects.toThrow("process.exit called");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to read session 'test-session'")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("passes flags from project config to claude", async () => {
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: ".claude/cc-fork/test-session.md",
      frontmatter: {
        id: "test-uuid",
        created: "2024-01-01",
        updated: "2024-01-01",
      },
      content: "test prompt",
    });
    vi.mocked(readProjectConfig).mockResolvedValue({
      model: "sonnet",
      verbose: true,
    });

    await fork("test-session", {});

    expect(forkSession).toHaveBeenCalledWith("test-uuid", "test-session", {
      model: "sonnet",
      verbose: true,
    });
  });

  it("merges project config and session frontmatter (session wins)", async () => {
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: ".claude/cc-fork/test-session.md",
      frontmatter: {
        id: "test-uuid",
        created: "2024-01-01",
        updated: "2024-01-01",
        model: "haiku",
      },
      content: "test prompt",
    });
    vi.mocked(readProjectConfig).mockResolvedValue({
      model: "sonnet",
      verbose: true,
    });

    await fork("test-session", {});

    expect(forkSession).toHaveBeenCalledWith("test-uuid", "test-session", {
      model: "haiku",
      verbose: true,
    });
  });

  it("CLI flags override both session frontmatter and project config", async () => {
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: ".claude/cc-fork/test-session.md",
      frontmatter: {
        id: "test-uuid",
        created: "2024-01-01",
        updated: "2024-01-01",
        model: "haiku",
        "dangerously-skip-permissions": true,
      },
      content: "test prompt",
    });
    vi.mocked(readProjectConfig).mockResolvedValue({
      verbose: true,
    });

    await fork("test-session", {
      model: "opus",
      "dangerously-skip-permissions": false,
    });

    expect(forkSession).toHaveBeenCalledWith("test-uuid", "test-session", {
      model: "opus",
      "dangerously-skip-permissions": false,
      verbose: true,
    });
  });

  it("handles empty flags at all levels", async () => {
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: ".claude/cc-fork/test-session.md",
      frontmatter: {
        id: "test-uuid",
        created: "2024-01-01",
        updated: "2024-01-01",
      },
      content: "test prompt",
    });
    vi.mocked(readProjectConfig).mockResolvedValue({});

    await fork("test-session", {});

    expect(forkSession).toHaveBeenCalledWith("test-uuid", "test-session", {});
  });

  it("passes array flags from frontmatter", async () => {
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: ".claude/cc-fork/test-session.md",
      frontmatter: {
        id: "test-uuid",
        created: "2024-01-01",
        updated: "2024-01-01",
        allowedTools: ["Bash(git *)", "Read", "Edit"],
      },
      content: "test prompt",
    });
    vi.mocked(readProjectConfig).mockResolvedValue({});

    await fork("test-session", {});

    expect(forkSession).toHaveBeenCalledWith("test-uuid", "test-session", {
      allowedTools: ["Bash(git *)", "Read", "Edit"],
    });
  });
});
