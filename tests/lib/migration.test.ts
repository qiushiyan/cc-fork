import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestDir, cleanupTestDir } from "../utils.js";

vi.mock("../../src/lib/prompt.js", () => ({
  confirm: vi.fn(),
}));

import { confirm } from "../../src/lib/prompt.js";
import { checkLegacyConfigDir } from "../../src/lib/config.js";

describe("checkLegacyConfigDir", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("does nothing when neither directory exists", async () => {
    await checkLegacyConfigDir(testDir);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("does nothing when only new directory exists", async () => {
    await mkdir(join(testDir, ".cc-fork"), { recursive: true });
    await checkLegacyConfigDir(testDir);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("prompts when only legacy directory exists", async () => {
    await mkdir(join(testDir, ".claude", "cc-fork"), { recursive: true });
    vi.mocked(confirm).mockResolvedValue(true);

    await checkLegacyConfigDir(testDir);

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("Move configuration")
    );
  });

  it("moves legacy directory to new location on confirm", async () => {
    const legacyDir = join(testDir, ".claude", "cc-fork");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, "test.md"), "content");
    vi.mocked(confirm).mockResolvedValue(true);

    await checkLegacyConfigDir(testDir);

    const newDir = join(testDir, ".cc-fork");
    const newFile = join(newDir, "test.md");
    await expect(stat(newFile)).resolves.toBeDefined();
    const contents = await readFile(newFile, "utf-8");
    expect(contents).toBe("content");
    await expect(stat(legacyDir)).rejects.toThrow();
  });

  it("exits when user declines migration", async () => {
    await mkdir(join(testDir, ".claude", "cc-fork"), { recursive: true });
    vi.mocked(confirm).mockResolvedValue(false);

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(checkLegacyConfigDir(testDir)).rejects.toThrow(
      "process.exit called"
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it("errors when both directories exist", async () => {
    await mkdir(join(testDir, ".claude", "cc-fork"), { recursive: true });
    await mkdir(join(testDir, ".cc-fork"), { recursive: true });

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(checkLegacyConfigDir(testDir)).rejects.toThrow(
      "process.exit called"
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
