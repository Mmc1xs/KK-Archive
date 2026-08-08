import "./load-env";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
};

const outPath = path.resolve(process.cwd(), "docs", "codex-handoff.md");

const importantScripts = [
  "dev",
  "build",
  "build:postgres",
  "guard:image-cost",
  "tool:vue:check",
  "tool:vue:build",
  "sync:new",
  "sync:all",
  "cut:import:queue",
  "mods:sync:telegram",
];

async function readPackageJson() {
  const packageJsonModule = (await import("../package.json")) as PackageJson;
  return packageJsonModule;
}

function formatScriptList(scripts: Record<string, string>) {
  return importantScripts
    .filter((name) => scripts[name])
    .map((name) => `- \`${name}\`: \`${scripts[name]}\``)
    .join("\n");
}

async function main() {
  const packageJson = await readPackageJson();
  const scripts = packageJson.scripts ?? {};
  const generatedAt = new Date().toISOString();

  const body = `# Codex Handoff

Generated: \`${generatedAt}\`

## Read First

1. \`AGENTS.md\`
2. \`docs/codex-quick-start.md\`
3. Relevant feature files before editing

## Repo Snapshot

- App: Next.js 16 and React 19 with Prisma-backed structured tag search
- Tool frontend: Vue 3 and Vite Plugin Data Reader
- Data: Supabase Postgres
- Storage: Cloudflare R2 for images and hosted files
- Deployment: Vercel with five-minute homepage ISR
- Search rule: existing DB tags only, no free-text search
- Roles: \`ADMIN\`, \`AUDIT\`, and \`MEMBER\`

## Important Commands

${formatScriptList(scripts)}

## High-Value Files

- \`AGENTS.md\`
- \`docs/codex-quick-start.md\`
- \`lib/content.ts\`
- \`lib/db.ts\`
- \`components/home-page-view.tsx\`
- \`components/tag-autocomplete.tsx\`
- \`tools/plugin-data-reader-vue/src/App.vue\`
- \`docs/cut-telegram-semi-auto-workflow.md\`
- \`docs/mod-library-telegram-sync.md\`

## Notes For New Sessions

- Run website development, build, Git, commit, and push commands only from \`C:\\Users\\mlcmlc\\Desktop\\KK Diction Website\`.
- Local \`cut\` and \`up_mod\` data stays outside Git under \`C:\\Users\\mlcmlc\\Desktop\\KK Diction\`; use its \`cut.ps1\` and \`up_mod.ps1\` launchers instead of scanning or moving that workspace.
- Never include \`db image/\` or \`db mods/\` in website commits. See \`docs/workflow-storage.md\` for path resolution.
- Locale homepages share five-minute caches for Latest Published and bulletins.
- Bulletin writes invalidate the bulletin cache; content writes invalidate Latest Published.
- Admin tag autocomplete has a two-minute browser cache and in-flight request deduplication.
- Homepage bulletins are database-managed at \`/admin/homepage/bulletins\` and do not require deployment.
- Mod Library records use Telegram message links and are restricted to signed-in members.
- Run \`git status --short\` at the start of every task; this handoff intentionally does not snapshot transient worktree state.
- Follow \`AGENTS.md\` pre-push UI and build verification rules.
`;

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, body, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error("[CODEX HANDOFF] Failed to generate handoff.", error);
  process.exit(1);
});
