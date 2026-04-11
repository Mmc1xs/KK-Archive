import "./load-env";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

type PackageJson = {
  scripts?: Record<string, string>;
};

const execFileAsync = promisify(execFile);
const outPath = path.resolve(process.cwd(), "docs", "codex-handoff.md");

const importantScripts = [
  "dev",
  "build",
  "sync:new",
  "sync:all",
  "r2:upload-clean:new",
  "r2:upload-clean",
  "tag:export-review",
  "tag:import-review",
];

async function readPackageJson() {
  const packageJsonModule = (await import("../package.json")) as PackageJson;
  return packageJsonModule;
}

async function getGitOutput(args: string[]) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: process.cwd(),
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

function formatScriptList(scripts: Record<string, string>) {
  return importantScripts
    .filter((name) => scripts[name])
    .map((name) => `- \`${name}\`: \`${scripts[name]}\``)
    .join("\n");
}

function formatWorktree(statusOutput: string) {
  if (!statusOutput) {
    return "- clean worktree";
  }

  return statusOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `- \`${line}\``)
    .join("\n");
}

async function main() {
  const packageJson = await readPackageJson();
  const scripts = packageJson.scripts ?? {};
  const branch = (await getGitOutput(["branch", "--show-current"])) || "unknown";
  const status = await getGitOutput(["status", "--short"]);
  const generatedAt = new Date().toISOString();

  const body = `# Codex Handoff

Generated: \`${generatedAt}\`

## Read First

1. \`AGENTS.md\`
2. \`docs/codex-quick-start.md\`
3. Relevant feature files before editing

## Repo Snapshot

- Branch: \`${branch}\`
- App: Next.js app with Prisma-backed structured tag search
- Storage: Cloudflare R2 for public images
- Search rule: existing DB tags only, no free-text search
- Important data workspace: \`db image\`

## Important Commands

${formatScriptList(scripts)}

## Current Worktree

${formatWorktree(status)}

## High-Value Files

- \`AGENTS.md\`
- \`docs/codex-quick-start.md\`
- \`lib/content.ts\`
- \`lib/db.ts\`
- \`components/tag-links.tsx\`
- \`scripts/import-tag-review-json.ts\`
- \`scripts/build-work-tag-json.ts\`
- \`db image/grab_telegram_images.py\`

## Notes For New Sessions

- \`db image/tag/*.json\` is review data used to backfill work/character/style tags.
- \`db image/tag.json\` is a generated alias map for work tags.
- Telegram raw media grabbing and clean import are related but separate workflows.
- If the task is about content visibility, check \`publishStatus\` handling in Prisma and content queries.
`;

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, body, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error("[CODEX HANDOFF] Failed to generate handoff.", error);
  process.exit(1);
});
