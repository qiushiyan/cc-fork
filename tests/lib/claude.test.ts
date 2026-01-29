import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { resumeSession } from "../../src/lib/claude.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

describe("resumeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should spawn claude with --resume flag", async () => {
    const mockStderr = {
      on: vi.fn(),
    };
    const mockChild = {
      stderr: mockStderr,
      on: vi.fn((event: string, callback: Function) => {
        if (event === "close") {
          setTimeout(() => callback(0), 0);
        }
        return mockChild;
      }),
    };

    vi.mocked(spawn).mockReturnValue(mockChild as any);

    await resumeSession("test-uuid", "test-session");

    expect(spawn).toHaveBeenCalledWith("claude", ["--resume", "test-uuid"], {
      stdio: ["inherit", "inherit", "pipe"],
    });
  });

  it("should reject if claude exits with non-zero code", async () => {
    const mockStderr = {
      on: vi.fn(),
    };
    const mockChild = {
      stderr: mockStderr,
      on: vi.fn((event: string, callback: Function) => {
        if (event === "close") {
          setTimeout(() => callback(1), 0);
        }
        return mockChild;
      }),
    };

    vi.mocked(spawn).mockReturnValue(mockChild as any);

    await expect(resumeSession("test-uuid", "test-session")).rejects.toThrow(
      "Claude CLI exited with code 1"
    );
  });

  it("should reject with helpful message for stale session", async () => {
    const mockStderr = {
      on: vi.fn((event: string, callback: Function) => {
        if (event === "data") {
          setTimeout(() => callback(Buffer.from("No conversation found with session ID")), 0);
        }
      }),
    };
    const mockChild = {
      stderr: mockStderr,
      on: vi.fn((event: string, callback: Function) => {
        if (event === "close") {
          setTimeout(() => callback(1), 10);
        }
        return mockChild;
      }),
    };

    vi.mocked(spawn).mockReturnValue(mockChild as any);

    await expect(resumeSession("test-uuid", "test-session")).rejects.toThrow(
      "Session 'test-session' has a stale session ID. Run 'cc-fork refresh test-session' to rebuild."
    );
  });

  it("should reject if spawn fails", async () => {
    const mockStderr = {
      on: vi.fn(),
    };
    const mockChild = {
      stderr: mockStderr,
      on: vi.fn((event: string, callback: Function) => {
        if (event === "error") {
          setTimeout(() => callback(new Error("spawn failed")), 0);
        }
        return mockChild;
      }),
    };

    vi.mocked(spawn).mockReturnValue(mockChild as any);

    await expect(resumeSession("test-uuid", "test-session")).rejects.toThrow(
      "Failed to spawn claude: spawn failed"
    );
  });
});
