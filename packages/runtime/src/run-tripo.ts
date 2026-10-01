import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { commitModel } from "./commit-model.ts";
import { extraPath, labProxyEnv } from "./spawn-paths.ts";

function findGlb(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur, { withFileTypes: true })) {
      const p = join(cur, name.name);
      if (name.isDirectory()) stack.push(p);
      else if (name.name.toLowerCase().endsWith(".glb")) return p;
    }
  }
  return null;
}

export function runTripo(workspace: string, prompt = "a cute low poly fox"): string {
  const outDir = join(workspace, "exports/lab-tripo");
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync("tripo", ["make", prompt, "--yes", "--quiet", "--no-open", "-o", outDir], {
    cwd: workspace,
    encoding: "utf8",
    env: { ...process.env, PATH: extraPath(), ...labProxyEnv() },
    timeout: 180_000,
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `tripo exit ${r.status}`).slice(0, 2000));
  }
  const glb = findGlb(outDir);
  if (!glb) throw new Error("tripo did not write a glb under exports/lab-tripo");
  return commitModel(workspace, "fox", glb);
}
