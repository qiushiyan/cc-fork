import { spawn } from "node:child_process";
import type { ClaudeFlags, ClaudeResponse } from "../types.js";
import { flagsToArgs } from "./flags.js";

export async function createBaseSession(
  uuid: string,
  prompt: string,
  flags: ClaudeFlags = {}
): Promise<ClaudeResponse> {
  return new Promise((resolve, reject) => {
    const flagArgs = flagsToArgs(flags);
    const args = [
      "--session-id",
      uuid,
      "-p",
      prompt,
      "--output-format",
      "json",
      ...flagArgs,
    ];

    const child = spawn("claude", args, {
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const response = JSON.parse(stdout) as ClaudeResponse;
        resolve(response);
      } catch {
        reject(new Error(`Failed to parse Claude response: ${stdout}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export async function createBaseSessionInteractive(
  uuid: string,
  prompt: string,
  flags: ClaudeFlags = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const flagArgs = flagsToArgs(flags);
    // Use positional prompt (starts interactive REPL with initial prompt)
    const args = ["--session-id", uuid, prompt, ...flagArgs];

    const child = spawn("claude", args, {
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}`));
        return;
      }
      resolve();
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export interface SessionError extends Error {
  stderr?: string;
}

export async function forkSession(
  uuid: string,
  sessionName: string,
  flags: ClaudeFlags = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const flagArgs = flagsToArgs(flags);
    const args = ["--resume", uuid, "--fork-session", ...flagArgs];

    const child = spawn("claude", args, {
      stdio: ["inherit", "inherit", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const isStaleSession = stderr.includes("No conversation found");
        const error: SessionError = new Error(
          isStaleSession
            ? `Session '${sessionName}' has a stale session ID. Run 'cc-fork refresh ${sessionName}' to rebuild.`
            : `Claude CLI exited with code ${code}`
        );
        error.stderr = stderr.trim();
        reject(error);
        return;
      }
      resolve();
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export async function resumeSession(
  uuid: string,
  sessionName: string,
  flags: ClaudeFlags = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const flagArgs = flagsToArgs(flags);
    const args = ["--resume", uuid, ...flagArgs];

    const child = spawn("claude", args, {
      stdio: ["inherit", "inherit", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const isStaleSession = stderr.includes("No conversation found");
        const error: SessionError = new Error(
          isStaleSession
            ? `Session '${sessionName}' has a stale session ID. Run 'cc-fork refresh ${sessionName}' to rebuild.`
            : `Claude CLI exited with code ${code}`
        );
        error.stderr = stderr.trim();
        reject(error);
        return;
      }
      resolve();
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}
