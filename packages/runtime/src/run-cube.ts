import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { commitModel } from "./commit-model.ts";
import { loadConfig } from "./codex-home.ts";
import { templatesRoot } from "./workspace.ts";

export function runCube(workspace: string): string {
  const cfg = loadConfig();
  const scriptSrc = join(templatesRoot, "scripts/lab-cube.py");
  const scriptDest = join(workspace, "scripts/lab-cube.py");
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "exports"), { recursive: true });
  copyFileSync(scriptSrc, scriptDest);
  if (!existsSync(cfg.blenderBin)) {
    throw new Error(`BLENDER_BIN missing: ${cfg.blenderBin}`);
  }
  const r = spawnSync(cfg.blenderBin, ["--background", "--python", scriptDest], {
    cwd: workspace,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || `blender exit ${r.status}`);
  }
  const glb = join(workspace, "exports/lab-cube.glb");
  if (!existsSync(glb)) throw new Error("blender did not write exports/lab-cube.glb");
  return commitModel(workspace, "cube", glb);
}
