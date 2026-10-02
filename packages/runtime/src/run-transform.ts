import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseAssetName, type TransformOp } from "@lab3d/protocol";
import { commitModel } from "./commit-model.ts";
import { loadConfig } from "./codex-home.ts";
import { blenderArgs, blenderEnv } from "./spawn-paths.ts";
import { templatesRoot } from "./workspace.ts";

export function resolveWorkspaceGlb(workspace: string, source: string): string {
  const base = basename(source);
  if (!/^lab-[\w-]+_\d+\.glb$/i.test(base)) throw new Error(`bad source ${source}`);
  const dest = resolve(join(workspace, base));
  const root = resolve(workspace);
  if (!dest.startsWith(root + "/") && dest !== root) throw new Error("source escapes workspace");
  if (!existsSync(dest)) throw new Error(`missing ${base}`);
  return dest;
}

export function runTransform(
  workspace: string,
  opts: { source: string; op: TransformOp; height?: number; yaw?: number },
): string {
  const src = resolveWorkspaceGlb(workspace, opts.source);
  const family = parseAssetName(src).family;
  const cfg = loadConfig();
  const scriptDest = join(workspace, "scripts/lab-transform.py");
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "exports"), { recursive: true });
  copyFileSync(join(templatesRoot, "scripts/lab-transform.py"), scriptDest);
  const out = join(workspace, "exports/lab-transform.glb");
  let height = opts.height ?? 0;
  let yaw = opts.yaw ?? 0;
  if (opts.op === "height" && !height) height = 1.7;
  if (opts.op === "yaw" && !yaw) yaw = 90;
  const env = {
    ...blenderEnv(),
    LAB_SRC: src,
    LAB_OUT: out,
    LAB_HEIGHT: String(height),
    LAB_YAW: String(yaw),
  };
  const r = spawnSync(cfg.blenderBin, blenderArgs(scriptDest), {
    cwd: workspace,
    encoding: "utf8",
    env,
    timeout: 120_000,
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `blender exit ${r.status}`).slice(0, 4000));
  }
  if (!existsSync(out)) throw new Error("transform wrote no glb");
  return commitModel(workspace, family, out);
}
