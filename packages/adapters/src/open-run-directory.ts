import { spawn } from "node:child_process";

export async function openRunDirectory(runDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", [runDir], { stdio: "ignore", shell: false });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Failed to open run directory with open. code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
  });
}
