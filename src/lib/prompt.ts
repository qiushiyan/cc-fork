import { createInterface } from "node:readline";
import { spawn } from "node:child_process";

export async function askQuestion(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function confirm(message: string): Promise<boolean> {
  const answer = await askQuestion(`${message} (y/N): `);
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

export interface Choice {
  label: string;
  value: string;
}

export async function choose(
  message: string,
  choices: Choice[]
): Promise<string> {
  console.log(message);
  console.log();
  for (let i = 0; i < choices.length; i++) {
    console.log(`  ${i + 1}) ${choices[i]!.label}`);
  }
  console.log();

  const answer = await askQuestion(`Choose an option (1-${choices.length}): `);
  const index = parseInt(answer, 10) - 1;

  if (isNaN(index) || index < 0 || index >= choices.length) {
    return choices[choices.length - 1]!.value;
  }

  return choices[index]!.value;
}

export async function openEditor(filePath: string): Promise<void> {
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";

  return new Promise((resolve, reject) => {
    const child = spawn(editor, [filePath], {
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Editor exited with code ${code}`));
        return;
      }
      resolve();
    });

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            `Editor '${editor}' not found. Edit the file manually at:\n  ${filePath}`
          )
        );
      } else {
        reject(new Error(`Failed to open editor: ${err.message}`));
      }
    });
  });
}
