import "./load-env";
import { spawnSync } from "child_process";

function runStep(label: string, args: string[]) {
  console.log(`[SYNC:ALL] ${label}`);

  const result = spawnSync("npx", ["tsx", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${label} failed`).trim());
  }
}

function main() {
  runStep("manifest", ["scripts/build-clean-import-manifest.ts"]);
  runStep("pixiv", ["scripts/enrich-clean-from-pixiv.ts"]);
  runStep("r2", ["scripts/upload-clean-to-r2.ts"]);
  runStep("post-json", ["scripts/write-post-json-from-clean.ts"]);
  runStep("import", ["scripts/import-all-clean-posts.ts"]);
}

main();
