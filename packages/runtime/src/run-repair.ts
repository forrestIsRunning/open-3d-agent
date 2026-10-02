import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseAssetName } from "@lab3d/protocol";
import { commitModel } from "./commit-model.ts";
import { loadConfig } from "./codex-home.ts";
import { blenderArgs, blenderEnv } from "./spawn-paths.ts";
import { resolveWorkspaceGlb } from "./run-transform.ts";
import { templatesRoot } from "./workspace.ts";

export function runFillHoles(workspace: string, source: string): string {
  const src = resolveWorkspaceGlb(workspace, source);
  const family = parseAssetName(src).family;
  const cfg = loadConfig();
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "exports"), { recursive: true });
  copyFileSync(join(templatesRoot, "scripts/lab-fill-holes.py"), join(workspace, "scripts/lab-fill-holes.py"));
  const out = join(workspace, "exports/lab-fill-holes.glb");
  const r = spawnSync(cfg.blenderBin, blenderArgs(join(workspace, "scripts/lab-fill-holes.py")), {
    cwd: workspace,
    encoding: "utf8",
    env: { ...blenderEnv(), LAB_SRC: src, LAB_OUT: out },
    timeout: 120_000,
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `blender exit ${r.status}`).slice(0, 4000));
  }
  if (!existsSync(out)) throw new Error("fill-holes wrote no glb");
  return commitModel(workspace, family, out);
}
