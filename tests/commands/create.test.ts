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
}));

vi.mock("../../src/lib/prompt.js", () => ({
  askQuestion: vi.fn(),
  openEditor: vi.fn(),
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
} from "../../src/lib/config.js";
import { openEditor } from "../../src/lib/prompt.js";

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

    expect(writeSession).toHaveBeenCalledWith(
      "test-session",
      expect.objectContaining({
        model: "haiku",
        "dangerously-skip-permissions": true,
      }),
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

  it("stores reserved fields correctly alongside flags", async () => {
    await create("test-session", { model: "haiku" });

    expect(writeSession).toHaveBeenCalledWith(
      "test-session",
      expect.objectContaining({
        id: expect.any(String),
        created: expect.any(String),
        updated: expect.any(String),
        model: "haiku",
      }),
      "test prompt content"
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
});
