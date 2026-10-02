import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitModel } from "./commit-model.ts";
import { extraPath, labProxyEnv } from "./spawn-paths.ts";

export function findGlb(dir: string): string | null {
  return findFile(dir, (n) => n.toLowerCase().endsWith(".glb"));
}

export function findImage(dir: string): string | null {
  return findFile(dir, (n) => /\.(png|jpe?g|webp)$/i.test(n) && !/preview/i.test(n));
}

function findFile(dir: string, ok: (name: string) => boolean): string | null {
  if (!existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur, { withFileTypes: true })) {
      const p = join(cur, name.name);
      if (name.isDirectory()) stack.push(p);
      else if (ok(name.name)) return p;
    }
  }
  return null;
}

export function spawnTripo(workspace: string, args: string[], outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync("tripo", [...args, "--yes", "--quiet", "--no-open", "-o", outDir], {
    cwd: workspace,
    encoding: "utf8",
    env: { ...process.env, PATH: extraPath(), ...labProxyEnv() },
    timeout: Number(process.env.LAB_TRIPO_TIMEOUT_MS ?? 600_000),
  });
  if (r.status !== 0) {
    const why = r.signal ? `tripo signal ${r.signal}` : `tripo exit ${r.status}`;
    throw new Error((r.stderr || r.stdout || why).slice(0, 2000));
  }
}

export function runTripo(
  workspace: string,
  prompt = "a cute low poly fox",
  name = "fox",
  imagePath?: string,
): string {
  const outDir = join(workspace, "exports", `lab-tripo-${name}-${Date.now()}`);
  mkdirSync(outDir, { recursive: true });
  if (process.env.LAB_TRIPO_STUB === "1") {
    const stub = join(outDir, "stub.glb");
    writeFileSync(stub, "glTF-stub");
    return commitModel(workspace, name, stub);
  }
  if (imagePath) {
    if (!existsSync(imagePath)) throw new Error(`image missing: ${imagePath}`);
    spawnTripo(
      workspace,
      ["generate", "image-to-model", imagePath, "--prompt", prompt],
      outDir,
    );
  } else {
    spawnTripo(workspace, ["make", prompt], outDir);
  }
  const glb = findGlb(outDir);
  if (!glb) throw new Error("tripo did not write a glb under exports/lab-tripo");
  return commitModel(workspace, name, glb);
}
