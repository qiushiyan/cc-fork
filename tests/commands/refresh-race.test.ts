import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestDir, cleanupTestDir } from "../utils.js";
import { ensureConfigDir } from "../../src/lib/config.js";
import { writeSession } from "../../src/lib/session.js";

vi.mock("../../src/lib/claude.js", () => ({
  createBaseSession: vi.fn(),
  createBaseSessionInteractive: vi.fn(),
}));

vi.mock("../../src/lib/user-storage.js", () => ({
  readUserSession: vi.fn(),
  writeUserSession: vi.fn(),
  computePromptHash: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import { refresh } from "../../src/commands/refresh.js";
import {
  createBaseSession,
  createBaseSessionInteractive,
} from "../../src/lib/claude.js";
import {
  readUserSession,
  writeUserSession,
  computePromptHash,
} from "../../src/lib/user-storage.js";

describe("refresh command - race safety", () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  let testDir: string;
  let originalCwd: string;
  let sessionPath: string;
  let signalClaudeStarted!: () => void;
  let claudeStarted: Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalCwd = process.cwd();
    testDir = await createTestDir();
    process.chdir(testDir);

    await ensureConfigDir(testDir);
    sessionPath = join(testDir, ".claude", "cc-fork", "base.md");
    await writeSession("base", { model: "haiku" }, "Initial prompt", testDir);

    claudeStarted = new Promise<void>((resolve) => {
      signalClaudeStarted = resolve;
    });

    vi.mocked(createBaseSessionInteractive).mockImplementation(async () => {
      signalClaudeStarted();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    vi.mocked(createBaseSession).mockResolvedValue({
      session_id: "new-uuid",
      result: "ok",
    });
    vi.mocked(readUserSession).mockResolvedValue({
      id: "old-uuid",
      created: "2024-01-01T00:00:00.000Z",
      updated: "2024-01-01T00:00:00.000Z",
      promptHash: "oldhash",
    });
    vi.mocked(writeUserSession).mockResolvedValue();
    vi.mocked(computePromptHash).mockReturnValue("newhash");
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestDir(testDir);
    vi.clearAllMocks();
  });

  it("preserves edits made while refresh is running", async () => {
    const refreshPromise = refresh("base");

    await claudeStarted;
    await writeFile(sessionPath, "Edited during refresh\n", "utf-8");

    await refreshPromise;

    const finalContent = await readFile(sessionPath, "utf-8");
    expect(finalContent).toContain("Edited during refresh");

    expect(createBaseSessionInteractive).toHaveBeenCalledTimes(1);
    const claudePrompt = vi.mocked(createBaseSessionInteractive).mock.calls[0]?.[1];
    expect(claudePrompt).toContain("Initial prompt");
  });
});
