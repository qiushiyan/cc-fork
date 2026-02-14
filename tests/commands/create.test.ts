import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { create } from "../../src/commands/create.js";
vi.mock("../../src/lib/session.js", () => ({
  validateSessionName: vi.fn(),
  sessionExists: vi.fn(),
  readSession: vi.fn(),
  writeSession: vi.fn(),
  getDefaultTemplate: vi.fn(),
}));

vi.mock("../../src/lib/claude.js", () => ({
  createBaseSession: vi.fn(),
  createBaseSessionInteractive: vi.fn(),
}));

vi.mock("../../src/lib/config.js", () => ({
  ensureConfigDir: vi.fn(),
  getSessionPath: vi.fn(),
  readProjectConfig: vi.fn(),
}));

vi.mock("../../src/lib/prompt.js", () => ({
  askQuestion: vi.fn(),
  openEditor: vi.fn(),
}));

vi.mock("../../src/lib/user-storage.js", () => ({
  writeUserSession: vi.fn(),
  readUserSession: vi.fn(),
  deleteUserSession: vi.fn(),
  computePromptHash: vi.fn(),
  clearProjectIdCache: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import {
  validateSessionName,
  sessionExists,
  readSession,
  writeSession,
  getDefaultTemplate,
} from "../../src/lib/session.js";
import {
  createBaseSession,
  createBaseSessionInteractive,
} from "../../src/lib/claude.js";
import {
  ensureConfigDir,
  getSessionPath,
  readProjectConfig,
} from "../../src/lib/config.js";
import { openEditor } from "../../src/lib/prompt.js";
import {
  writeUserSession,
  readUserSession,
  computePromptHash,
} from "../../src/lib/user-storage.js";

describe("create command - flag passthrough", () => {
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateSessionName).mockImplementation(() => {});
    vi.mocked(sessionExists).mockResolvedValue(false);
    vi.mocked(ensureConfigDir).mockResolvedValue("/test/.claude/cc-fork");
    vi.mocked(getSessionPath).mockReturnValue("/test/.claude/cc-fork/test.md");
    vi.mocked(getDefaultTemplate).mockReturnValue("default template");
    vi.mocked(writeSession).mockResolvedValue();
    vi.mocked(openEditor).mockResolvedValue();
    vi.mocked(readSession).mockResolvedValue({
      name: "test-session",
      path: "/test/.claude/cc-fork/test.md",
      frontmatter: {},
      content: "test prompt content",
    });
    vi.mocked(createBaseSession).mockResolvedValue({
      session_id: "new-uuid",
      result: "Session created",
    });
    vi.mocked(createBaseSessionInteractive).mockResolvedValue();
    vi.mocked(readProjectConfig).mockResolvedValue({});
    vi.mocked(writeUserSession).mockResolvedValue();
    vi.mocked(readUserSession).mockResolvedValue(null);
    vi.mocked(computePromptHash).mockReturnValue("abc123");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes CLI flags to createBaseSessionInteractive (default mode)", async () => {
    await create("test-session", {
      model: "haiku",
      "dangerously-skip-permissions": true,
    });

    expect(createBaseSessionInteractive).toHaveBeenCalledWith(
      expect.any(String),
      "test prompt content",
      {
        model: "haiku",
        "dangerously-skip-permissions": true,
      }
    );
  });

  it("stores CLI flags in frontmatter", async () => {
    await create("test-session", {
      model: "haiku",
      "dangerously-skip-permissions": true,
    });

    // Only flags are stored in frontmatter (no id/timestamps)
    expect(writeSession).toHaveBeenCalledWith(
      "test-session",
      {
        model: "haiku",
        "dangerously-skip-permissions": true,
      },
      "test prompt content"
    );
  });

  it("uses CLI flags directly without project config merge", async () => {
    await create("test-session", {
      model: "haiku",
    });

    // Only CLI flags are passed — no project config involved
    expect(createBaseSessionInteractive).toHaveBeenCalledWith(
      expect.any(String),
      "test prompt content",
      {
        model: "haiku",
      }
    );
  });

  it("stores session metadata in user storage", async () => {
    await create("test-session", { model: "haiku" });

    // Session metadata (id, created, updated, promptHash) goes to user storage
    expect(writeUserSession).toHaveBeenCalledWith(
      "test-session",
      expect.objectContaining({
        id: expect.any(String),
        created: expect.any(String),
        updated: expect.any(String),
        promptHash: expect.any(String),
      })
    );
  });

  it("uses inline prompt when -p is provided", async () => {
    await create("test-session", {}, { prompt: "inline prompt text" });

    expect(createBaseSessionInteractive).toHaveBeenCalledWith(
      expect.any(String),
      "inline prompt text",
      {}
    );
  });

  it("uses non-interactive mode when interactive is explicitly false", async () => {
    await create("test-session", { model: "haiku" }, { interactive: false });

    expect(createBaseSession).toHaveBeenCalledWith(
      expect.any(String),
      "test prompt content",
      { model: "haiku" }
    );
    expect(createBaseSessionInteractive).not.toHaveBeenCalled();
  });

  describe("--no-eval flag", () => {
    it("writes session file but does not call Claude", async () => {
      await create("test-session", {}, { noEval: true });

      expect(writeSession).toHaveBeenCalled();
      expect(createBaseSession).not.toHaveBeenCalled();
      expect(createBaseSessionInteractive).not.toHaveBeenCalled();
    });

    it("does not write user session metadata", async () => {
      await create("test-session", {}, { noEval: true });

      expect(writeUserSession).not.toHaveBeenCalled();
    });

    it("prints help message about running refresh", async () => {
      const mockLog = vi.spyOn(console, "log");
      await create("test-session", {}, { noEval: true });

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining("Created session file")
      );
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining("cc-fork refresh test-session")
      );
    });

    it("works with inline prompt via -p flag", async () => {
      await create("test-session", {}, { noEval: true, prompt: "my prompt" });

      expect(writeSession).toHaveBeenCalledWith("test-session", {}, "my prompt");
      expect(createBaseSession).not.toHaveBeenCalled();
      expect(createBaseSessionInteractive).not.toHaveBeenCalled();
      expect(writeUserSession).not.toHaveBeenCalled();
    });
  });
});
