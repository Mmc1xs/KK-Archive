import { existsSync } from "node:fs";
import path from "node:path";

export const siteRoot = path.resolve(process.cwd());

function resolveWorkflowRoot() {
  const configured = process.env.KK_WORKFLOW_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  const siblingRoot = path.resolve(siteRoot, "..", "KK Diction");
  return existsSync(siblingRoot) ? siblingRoot : siteRoot;
}

export const workflowRoot = resolveWorkflowRoot();
export const dbImageRoot = path.join(workflowRoot, "db image");
export const cutRoot = path.join(dbImageRoot, "cut");
export const dbModsRoot = path.join(workflowRoot, "db mods");

export function resolveWorkflowPath(relativePath: string) {
  const resolved = path.resolve(workflowRoot, relativePath);
  const relative = path.relative(workflowRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path must stay inside KK_WORKFLOW_ROOT: ${relativePath}`);
  }
  return resolved;
}
