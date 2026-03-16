import "./load-env";

import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";

const runtime = process.argv[2];

if (runtime !== "sqlite" && runtime !== "postgres") {
  console.error('Usage: tsx scripts/set-prisma-runtime.ts <sqlite|postgres>');
  process.exit(1);
}

const root = process.cwd();
const sourcePath = path.join(root, "prisma", `schema.${runtime}.prisma`);
const targetPath = path.join(root, "prisma", "schema.prisma");

const currentSource = readFileSync(sourcePath, "utf8");
const currentTarget = readFileSync(targetPath, "utf8");

if (currentSource === currentTarget) {
  console.log(`Prisma runtime is already set to ${runtime}.`);
  process.exit(0);
}

copyFileSync(sourcePath, targetPath);
console.log(`Prisma runtime switched to ${runtime}.`);
