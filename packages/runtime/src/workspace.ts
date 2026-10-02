import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../../..");
export const templatesRoot = join(repoRoot, "templates");

export function seedWorkspace(workspace: string, blenderBin?: string): void {
  mkdirSync(workspace, { recursive: true });
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "exports"), { recursive: true });
  mkdirSync(join(workspace, ".lab"), { recursive: true });
  let agents = readFileSync(join(templatesRoot, "AGENTS.md"), "utf8");
  if (blenderBin) {
    agents = agents.replaceAll("$BLENDER_BIN", blenderBin).replaceAll("`blender` on PATH", blenderBin);
    agents = agents.split("Absolute binary: `$BLENDER_BIN`").join(`Absolute binary: \`${blenderBin}\``);
  }
  writeFileSync(join(workspace, "AGENTS.md"), agents);
  copyTree(join(templatesRoot, "skills"), join(workspace, "skills"));
  for (const script of ["lab-cube.py", "lab-lamb.py", "lab-plaza.py", "lab-transform.py"]) {
    const src = join(templatesRoot, "scripts", script);
    if (existsSync(src)) copyTree(src, join(workspace, "scripts", script));
  }
}

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true });
}

export function nextModelPath(workspace: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  let n = 1;
  while (existsSync(join(workspace, `lab-${safe}_${n}.glb`))) n += 1;
  return join(workspace, `lab-${safe}_${n}.glb`);
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}
