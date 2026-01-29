import { describe, it, expect } from "vitest";
import {
  extractFlags,
  mergeFlags,
  flagsToArgs,
  parseCliArgs,
} from "../../src/lib/flags.js";

describe("extractFlags", () => {
  it("removes reserved keys (id, created, updated)", () => {
    const frontmatter = {
      id: "abc-123",
      created: "2024-01-01",
      updated: "2024-01-02",
      model: "haiku",
      "dangerously-skip-permissions": true,
    };
    expect(extractFlags(frontmatter)).toEqual({
      model: "haiku",
      "dangerously-skip-permissions": true,
    });
  });

  it("handles empty frontmatter", () => {
    expect(extractFlags({})).toEqual({});
  });

  it("handles frontmatter with only reserved keys", () => {
    const frontmatter = {
      id: "abc-123",
      created: "2024-01-01",
      updated: "2024-01-02",
    };
    expect(extractFlags(frontmatter)).toEqual({});
  });

  it("handles undefined values", () => {
    const frontmatter = {
      id: "abc-123",
      model: undefined,
      debug: true,
    };
    expect(extractFlags(frontmatter)).toEqual({ debug: true });
  });
});

describe("mergeFlags", () => {
  it("overrides with higher precedence", () => {
    expect(mergeFlags({ model: "sonnet" }, { model: "haiku" })).toEqual({
      model: "haiku",
    });
  });

  it("preserves non-overlapping keys", () => {
    expect(mergeFlags({ model: "sonnet" }, { debug: true })).toEqual({
      model: "sonnet",
      debug: true,
    });
  });

  it("handles empty objects", () => {
    expect(mergeFlags({}, {})).toEqual({});
    expect(mergeFlags({ model: "haiku" }, {})).toEqual({ model: "haiku" });
    expect(mergeFlags({}, { model: "haiku" })).toEqual({ model: "haiku" });
  });

  it("allows overriding with false", () => {
    expect(
      mergeFlags(
        { "dangerously-skip-permissions": true },
        { "dangerously-skip-permissions": false }
      )
    ).toEqual({ "dangerously-skip-permissions": false });
  });
});

describe("flagsToArgs", () => {
  it("handles string values", () => {
    expect(flagsToArgs({ model: "haiku" })).toEqual(["--model", "haiku"]);
  });

  it("handles boolean true", () => {
    expect(flagsToArgs({ "dangerously-skip-permissions": true })).toEqual([
      "--dangerously-skip-permissions",
    ]);
  });

  it("omits boolean false", () => {
    expect(flagsToArgs({ "dangerously-skip-permissions": false })).toEqual([]);
  });

  it("handles arrays", () => {
    expect(flagsToArgs({ allowedTools: ["Bash(git *)", "Read"] })).toEqual([
      "--allowedTools",
      "Bash(git *)",
      "Read",
    ]);
  });

  it("handles empty arrays", () => {
    expect(flagsToArgs({ allowedTools: [] })).toEqual([]);
  });

  it("handles multiple flags", () => {
    const flags = {
      model: "haiku",
      "dangerously-skip-permissions": true,
      verbose: false,
    };
    const args = flagsToArgs(flags);
    expect(args).toContain("--model");
    expect(args).toContain("haiku");
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--verbose");
  });

  it("handles empty object", () => {
    expect(flagsToArgs({})).toEqual([]);
  });
});

describe("parseCliArgs", () => {
  it("parses key-value pairs", () => {
    expect(parseCliArgs(["--model", "haiku"])).toEqual({ model: "haiku" });
  });

  it("parses key=value pairs", () => {
    expect(parseCliArgs(["--model=haiku"])).toEqual({ model: "haiku" });
  });

  it("parses key=value boolean true", () => {
    expect(parseCliArgs(["--verbose=true"])).toEqual({ verbose: true });
  });

  it("parses key=value boolean false", () => {
    expect(parseCliArgs(["--verbose=false"])).toEqual({ verbose: false });
  });

  it("parses key=value alongside positional args", () => {
    expect(parseCliArgs(["base", "--model=opus"])).toEqual({ model: "opus" });
  });

  it("last flag wins when mixed formats", () => {
    expect(parseCliArgs(["--model", "sonnet", "--model=opus"])).toEqual({
      model: "opus",
    });
  });

  it("parses boolean flags", () => {
    expect(parseCliArgs(["--dangerously-skip-permissions"])).toEqual({
      "dangerously-skip-permissions": true,
    });
  });

  it("parses explicit boolean true", () => {
    expect(parseCliArgs(["--verbose", "true"])).toEqual({ verbose: true });
  });

  it("parses explicit boolean false", () => {
    expect(parseCliArgs(["--verbose", "false"])).toEqual({ verbose: false });
  });

  it("parses multiple flags", () => {
    expect(
      parseCliArgs(["--model", "haiku", "--dangerously-skip-permissions"])
    ).toEqual({
      model: "haiku",
      "dangerously-skip-permissions": true,
    });
  });

  it("ignores non-flag arguments", () => {
    expect(parseCliArgs(["session-name", "--model", "haiku"])).toEqual({
      model: "haiku",
    });
  });

  it("handles empty array", () => {
    expect(parseCliArgs([])).toEqual({});
  });

  it("handles flag at end of args", () => {
    expect(parseCliArgs(["--verbose"])).toEqual({ verbose: true });
  });

  it("ignores standalone terminator", () => {
    expect(parseCliArgs(["--", "--model", "haiku"])).toEqual({ model: "haiku" });
  });

  it("ignores empty key from double dash", () => {
    expect(parseCliArgs(["--"])).toEqual({});
  });

  it("ignores terminator with key=value after", () => {
    expect(parseCliArgs(["--", "--model=haiku"])).toEqual({ model: "haiku" });
  });
});
