import "./load-env";
import { spawn } from "child_process";

function runStep(label: string, args: string[]) {
  console.log(`[SYNC:NEW] ${label}`);

  return new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", ...args], {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  await runStep("pixiv", ["scripts/enrich-new-clean-from-pixiv.ts"]);
  await runStep("r2", ["scripts/upload-new-clean-to-r2.ts"]);
  await runStep("post-json", ["scripts/write-new-post-json-from-clean.ts"]);
  await runStep("import", ["scripts/import-new-clean-posts.ts"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
