import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { commitModel } from "./commit-model.ts";
import { loadConfig } from "./codex-home.ts";
import { blenderArgs, blenderEnv } from "./spawn-paths.ts";
import { templatesRoot } from "./workspace.ts";

export function resolveLabScript(workspace: string, scriptName: string): string {
  const base = basename(scriptName);
  if (!/^lab-[a-z0-9-]+\.py$/.test(base)) {
    throw new Error(`script must be scripts/lab-*.py, got ${scriptName}`);
  }
  const dest = resolve(join(workspace, "scripts", base));
  const root = resolve(join(workspace, "scripts"));
  if (!dest.startsWith(root)) throw new Error("script path escapes workspace");
  return dest;
}

export function runBlenderScript(workspace: string, scriptName: string, commitName: string): string {
  const cfg = loadConfig();
  if (!existsSync(cfg.blenderBin)) {
    throw new Error(`BLENDER_BIN missing: ${cfg.blenderBin}`);
  }
  const destScript = resolveLabScript(workspace, scriptName);
  const srcTemplate = join(templatesRoot, "scripts", basename(scriptName));
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "exports"), { recursive: true });
  if (existsSync(srcTemplate)) copyFileSync(srcTemplate, destScript);
  if (!existsSync(destScript)) throw new Error(`missing script ${destScript}`);
  const r = spawnSync(cfg.blenderBin, blenderArgs(destScript), {
    cwd: workspace,
    encoding: "utf8",
    env: blenderEnv(),
    timeout: 120_000,
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `blender exit ${r.status}`).slice(0, 4000));
  }
  const stem = basename(scriptName).replace(/\.py$/, "");
  const glb = join(workspace, "exports", `${stem}.glb`);
  if (!existsSync(glb)) throw new Error(`blender did not write ${glb}`);
  return commitModel(workspace, commitName, glb);
}
