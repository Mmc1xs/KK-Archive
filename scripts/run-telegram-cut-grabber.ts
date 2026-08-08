import "./load-env";

import { spawn } from "node:child_process";
import path from "node:path";
import { dbImageRoot } from "./workflow-paths";

const scriptPath = path.join(dbImageRoot, "grab_telegram_images.py");
const child = spawn("python", [scriptPath, ...process.argv.slice(2)], {
  cwd: dbImageRoot,
  env: process.env,
  stdio: "inherit"
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
