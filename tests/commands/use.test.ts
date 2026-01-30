import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { use } from "../../src/commands/use.js";
vi.mock("../../src/lib/session.js", () => ({
  validateSessionName: vi.fn(),
  sessionExists: vi.fn(),
  readSession: vi.fn(),
}));

vi.mock("../../src/lib/claude.js", () => ({
  resumeSession: vi.fn(),
}));

vi.mock("../../src/lib/config.js", () => ({
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
import { resumeSession } from "../../src/lib/claude.js";
import { getSessionPath } from "../../src/lib/config.js";

describe("use command", () => {
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });
  const mockConsoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionPath).mockReturnValue(".claude/cc-fork/bad-session.md");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should exit with error for invalid session name", async () => {
    vi.mocked(validateSessionName).mockImplementation(() => {
      throw new Error("Invalid session name");
    });

    await expect(use("invalid name")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith("Invalid session name");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit with error if session does not exist", async () => {
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(false);

    await expect(use("nonexistent")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Session 'nonexistent' not found. Run 'cc-fork create nonexistent' first."
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit with error if session has no ID", async () => {
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(true);
    vi.mocked(readSession).mockResolvedValue({
      name: "no-id",
      path: ".claude/cc-fork/no-id.md",
      frontmatter: { created: "", updated: "" },
      content: "test prompt",
    });

    await expect(use("no-id")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Session 'no-id' has no base session. Run 'cc-fork create no-id' first."
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit with error if session file cannot be read", async () => {
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(true);
    vi.mocked(readSession).mockRejectedValue(new Error("bad frontmatter"));

    await expect(use("bad-session")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to read session 'bad-session'")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should resume session successfully", async () => {
    const sessionId = "test-uuid-123";
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(true);
    vi.mocked(readSession).mockResolvedValue({
      name: "my-session",
      path: ".claude/cc-fork/my-session.md",
      frontmatter: { id: sessionId, created: "", updated: "" },
      content: "test prompt",
    });
    vi.mocked(resumeSession).mockResolvedValue();

    await use("my-session");

    expect(resumeSession).toHaveBeenCalledWith(sessionId, "my-session", {});
    expect(mockConsoleLog).toHaveBeenCalledWith(
      "Resuming base session 'my-session'..."
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      "Exited base session 'my-session'"
    );
  });

  it("should exit with error if resumeSession fails", async () => {
    const sessionId = "test-uuid-123";
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(true);
    vi.mocked(readSession).mockResolvedValue({
      name: "my-session",
      path: ".claude/cc-fork/my-session.md",
      frontmatter: { id: sessionId, created: "", updated: "" },
      content: "test prompt",
    });
    vi.mocked(resumeSession).mockRejectedValue(new Error("Claude CLI failed"));

    await expect(use("my-session")).rejects.toThrow("process.exit called");

    expect(mockConsoleError).toHaveBeenCalledWith("Claude CLI failed");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
