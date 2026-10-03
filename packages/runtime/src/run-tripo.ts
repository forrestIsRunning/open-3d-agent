import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { commitModel } from "./commit-model.ts";
import { extraPath, labProxyEnv, tripoBin } from "./spawn-paths.ts";

let active: ChildProcess | null = null;

export function cancelActiveJob(): boolean {
  if (!active) return false;
  const child = active;
  try {
    child.kill("SIGTERM");
  } catch {
    return false;
  }
  setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }, 1500);
  return true;
}

export function findGlb(dir: string): string | null {
  return findFile(dir, (n) => n.toLowerCase().endsWith(".glb"));
}

export function findImage(dir: string): string | null {
  return (
    findFile(dir, (n) => /^generated_image\.(png|jpe?g|webp)$/i.test(n)) ||
    findFile(dir, (n) => /\.(png|jpe?g|webp)$/i.test(n) && !/preview/i.test(n)) ||
    findFile(dir, (n) => /\.(png|jpe?g|webp)$/i.test(n))
  );
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

export function spawnTripo(workspace: string, args: string[], outDir: string): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const timeoutMs = Number(process.env.LAB_TRIPO_TIMEOUT_MS ?? 600_000);
  return new Promise((resolve, reject) => {
    const child = spawn(tripoBin(), [...args, "--yes", "--quiet", "--no-open", "-o", outDir], {
      cwd: workspace,
      env: { ...process.env, PATH: extraPath(), ...labProxyEnv() },
    });
    active = child;
    let stderr = "";
    let stdout = "";
    child.stderr?.on("data", (d) => {
      stderr += String(d);
    });
    child.stdout?.on("data", (d) => {
      stdout += String(d);
    });
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    const done = (err?: Error) => {
      clearTimeout(timer);
      if (active === child) active = null;
      if (err) reject(err);
      else resolve();
    };
    child.on("error", (err) => done(err));
    child.on("close", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        done(new Error("cancelled"));
        return;
      }
      if (code !== 0) {
        const why = signal ? `tripo signal ${signal}` : `tripo exit ${code}`;
        done(new Error((stderr || stdout || why).slice(0, 2000)));
        return;
      }
      if (!findGlb(outDir) && !findImage(outDir)) {
        done(new Error((stderr || stdout || "tripo wrote no glb/image").slice(0, 2000)));
        return;
      }
      done();
    });
  });
}

export async function runTripo(
  workspace: string,
  prompt = "a cute low poly fox",
  name = "fox",
  imagePath?: string,
): Promise<string> {
  const outDir = join(workspace, "exports", `lab-tripo-${name}-${Date.now()}`);
  mkdirSync(outDir, { recursive: true });
  if (process.env.LAB_TRIPO_STUB === "1") {
    const stub = join(outDir, "stub.glb");
    writeFileSync(stub, "glTF-stub");
    return commitModel(workspace, name, stub);
  }
  if (imagePath) {
    if (!existsSync(imagePath)) throw new Error(`image missing: ${imagePath}`);
    await spawnTripo(
      workspace,
      ["generate", "image-to-model", imagePath, "--prompt", prompt],
      outDir,
    );
  } else {
    await spawnTripo(workspace, ["make", prompt], outDir);
  }
  const glb = findGlb(outDir);
  if (!glb) throw new Error("tripo did not write a glb under exports/lab-tripo");
  return commitModel(workspace, name, glb);
}
