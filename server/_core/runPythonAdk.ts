import path from "path";
import dotenv from "dotenv";
import { spawn } from "child_process";

const projectRoot = process.cwd();
dotenv.config({ path: path.resolve(projectRoot, ".env.local"), override: false });
dotenv.config({ path: path.resolve(projectRoot, ".env"), override: false });

const adkDir = path.resolve(projectRoot, "python-agents");
const adkScript = path.join(adkDir, "server.py");
const pythonCommand =
  process.platform === "win32"
    ? { command: "py", args: ["-3", adkScript] }
    : { command: "python3", args: [adkScript] };

const child = spawn(pythonCommand.command, pythonCommand.args, {
  cwd: adkDir,
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONUNBUFFERED: "1",
  },
});

child.on("error", error => {
  console.error(`[ADK] Failed to start Python service with ${pythonCommand.command}: ${error.message}`);
  process.exit(1);
});

child.on("exit", code => {
  process.exit(code ?? 0);
});
