import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readProjectConfig } from "../../src/lib/config.js";
import { readFile } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe("readProjectConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("parses YAML config with string values", async () => {
    vi.mocked(readFile).mockResolvedValue("model: haiku\n");

    const config = await readProjectConfig("/test");

    expect(config).toEqual({ model: "haiku" });
  });

  it("parses YAML config with boolean values", async () => {
    vi.mocked(readFile).mockResolvedValue(
      "dangerously-skip-permissions: true\nverbose: false\n"
    );

    const config = await readProjectConfig("/test");

    expect(config).toEqual({
      "dangerously-skip-permissions": true,
      verbose: false,
    });
  });

  it("parses YAML config with array values", async () => {
    vi.mocked(readFile).mockResolvedValue(
      'allowedTools:\n  - "Bash(git *)"\n  - Read\n'
    );

    const config = await readProjectConfig("/test");

    expect(config).toEqual({
      allowedTools: ["Bash(git *)", "Read"],
    });
  });

  it("parses YAML config with mixed values", async () => {
    vi.mocked(readFile).mockResolvedValue(
      'model: sonnet\ndangerously-skip-permissions: true\nallowedTools:\n  - "Bash(git *)"\n'
    );

    const config = await readProjectConfig("/test");

    expect(config).toEqual({
      model: "sonnet",
      "dangerously-skip-permissions": true,
      allowedTools: ["Bash(git *)"],
    });
  });

  it("returns empty object if config file does not exist", async () => {
    const error = new Error("ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    vi.mocked(readFile).mockRejectedValue(error);

    const config = await readProjectConfig("/test");

    expect(config).toEqual({});
  });

  it("throws error for other file read errors", async () => {
    const error = new Error("Permission denied") as NodeJS.ErrnoException;
    error.code = "EACCES";
    vi.mocked(readFile).mockRejectedValue(error);

    await expect(readProjectConfig("/test")).rejects.toThrow("Permission denied");
  });

  it("handles empty config file", async () => {
    vi.mocked(readFile).mockResolvedValue("");

    const config = await readProjectConfig("/test");

    expect(config).toEqual({});
  });
});
