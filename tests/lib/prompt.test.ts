import { describe, it, expect, vi, afterEach } from "vitest";
import { confirm } from "../../src/lib/prompt.js";

describe("confirm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false without reading stdin when not a TTY", async () => {
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });

    try {
      const result = await confirm("Proceed?");
      expect(result).toBe(false);
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: original, configurable: true });
    }
  });
});
