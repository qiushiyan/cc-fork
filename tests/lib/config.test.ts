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

  it("parses interactive option", async () => {
    vi.mocked(readFile).mockResolvedValue("interactive: true\n");

    const config = await readProjectConfig("/test");

    expect(config).toEqual({ interactive: true });
  });

  it("parses defaultCommand option", async () => {
    vi.mocked(readFile).mockResolvedValue("defaultCommand: use\n");

    const config = await readProjectConfig("/test");

    expect(config).toEqual({ defaultCommand: "use" });
  });

  it("parses both options together", async () => {
    vi.mocked(readFile).mockResolvedValue(
      "interactive: true\ndefaultCommand: use\n"
    );

    const config = await readProjectConfig("/test");

    expect(config).toEqual({ interactive: true, defaultCommand: "use" });
  });

  it("ignores unknown keys", async () => {
    vi.mocked(readFile).mockResolvedValue(
      "model: haiku\ninteractive: true\ndangerously-skip-permissions: true\n"
    );

    const config = await readProjectConfig("/test");

    expect(config).toEqual({ interactive: true });
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
