import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { refresh } from "../../src/commands/refresh.js";

vi.mock("../../src/lib/session.js", () => ({
  validateSessionName: vi.fn(),
  sessionExists: vi.fn(),
  readSession: vi.fn(),
  writeSession: vi.fn(),
}));

vi.mock("../../src/lib/claude.js", () => ({
  createBaseSession: vi.fn(),
  createBaseSessionInteractive: vi.fn(),
}));

vi.mock("../../src/lib/config.js", () => ({
  getSessionPath: vi.fn(),
  readProjectConfig: vi.fn(),
}));

vi.mock("../../src/lib/user-storage.js", () => ({
  readUserSession: vi.fn(),
  writeUserSession: vi.fn(),
  computePromptHash: vi.fn(),
  clearProjectIdCache: vi.fn(),
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
  writeSession,
} from "../../src/lib/session.js";
import {
  createBaseSession,
  createBaseSessionInteractive,
} from "../../src/lib/claude.js";
import { getSessionPath, readProjectConfig } from "../../src/lib/config.js";
import {
  readUserSession,
  writeUserSession,
  computePromptHash,
} from "../../src/lib/user-storage.js";

describe("refresh command", () => {
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(true);
    vi.mocked(getSessionPath).mockReturnValue(".claude/cc-fork/test-session.md");
    vi.mocked(readProjectConfig).mockResolvedValue({});
    vi.mocked(computePromptHash).mockReturnValue("newhash123");
    vi.mocked(createBaseSessionInteractive).mockResolvedValue();
    vi.mocked(createBaseSession).mockResolvedValue({
      session_id: "new-uuid",
      result: "done",
    });
    vi.mocked(writeUserSession).mockResolvedValue();
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: ".claude/cc-fork/test-session.md",
      frontmatter: { model: "haiku" },
      content: "# Updated prompt\n\nUser edited this manually.",
    });
    vi.mocked(readUserSession).mockResolvedValue({
      id: "old-uuid",
      created: "2024-01-01T00:00:00.000Z",
      updated: "2024-01-01T00:00:00.000Z",
      promptHash: "oldhash456",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not overwrite the session file during refresh", async () => {
    await refresh("test-session");

    // refresh should NEVER write back to the session file.
    // The .md file is read-only input for refresh — only user storage is updated.
    expect(writeSession).not.toHaveBeenCalled();
  });

  it("sends current file content to Claude in interactive mode", async () => {
    await refresh("test-session");

    expect(createBaseSessionInteractive).toHaveBeenCalledWith(
      expect.any(String),
      "# Updated prompt\n\nUser edited this manually.",
      { model: "haiku" }
    );
  });

  it("updates user storage with new session ID and prompt hash", async () => {
    await refresh("test-session");

    expect(writeUserSession).toHaveBeenCalledWith(
      "test-session",
      expect.objectContaining({
        id: expect.any(String),
        created: "2024-01-01T00:00:00.000Z",
        updated: expect.any(String),
        promptHash: "newhash123",
      })
    );
  });

  it("preserves original created timestamp from existing session", async () => {
    await refresh("test-session");

    expect(writeUserSession).toHaveBeenCalledWith(
      "test-session",
      expect.objectContaining({
        created: "2024-01-01T00:00:00.000Z",
      })
    );
  });

  it("uses non-interactive mode when interactive is false", async () => {
    await refresh("test-session", {}, { interactive: false });

    expect(createBaseSession).toHaveBeenCalledWith(
      expect.any(String),
      "# Updated prompt\n\nUser edited this manually.",
      { model: "haiku" }
    );
    expect(createBaseSessionInteractive).not.toHaveBeenCalled();
    expect(writeSession).not.toHaveBeenCalled();
  });

  it("merges CLI flags with session frontmatter flags", async () => {
    await refresh("test-session", { model: "opus", verbose: true });

    expect(createBaseSessionInteractive).toHaveBeenCalledWith(
      expect.any(String),
      "# Updated prompt\n\nUser edited this manually.",
      { model: "opus", verbose: true }
    );
  });
});
