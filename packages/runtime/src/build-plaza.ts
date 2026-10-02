import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./codex-home.ts";
import { loadDotenv } from "./dotenv.ts";
import { commitModel } from "./commit-model.ts";
import { runTripo } from "./run-tripo.ts";
import { blenderArgs, blenderEnv } from "./spawn-paths.ts";
import { seedWorkspace, templatesRoot } from "./workspace.ts";

loadDotenv();

const CAST: Array<{ name: string; prompt: string }> = [
  {
    name: "cat",
    prompt:
      "a cute small kitten, full-body 3D character, standing, fluffy fur, game-ready, clean silhouette, studio lighting",
  },
  {
    name: "puppy",
    prompt:
      "a cute small puppy, full-body 3D character, standing, floppy ears, game-ready, clean silhouette, studio lighting",
  },
  {
    name: "lamb",
    prompt:
      "a small lamb, full-body 3D character, standing, woolly, game-ready, clean silhouette, studio lighting",
  },
  {
    name: "fox",
    prompt:
      "a small fox, full-body 3D character, standing, bushy tail, game-ready, clean silhouette, studio lighting",
  },
  {
    name: "man",
    prompt:
      "an adult man, full-body 3D character, standing idle, realistic casual clothes, game-ready, studio lighting",
  },
  {
    name: "woman",
    prompt:
      "an adult woman, full-body 3D character, standing idle, realistic casual clothes, game-ready, studio lighting",
  },
];

function hasCast(ws: string, name: string): boolean {
  return readdirSync(ws).some((n) => new RegExp(`^lab-${name}_\\d+\\.glb$`, "i").test(n));
}

const ws = join(homedir(), "3d-agent-workspaces/default");
seedWorkspace(ws);
mkdirSync(join(ws, "exports"), { recursive: true });
mkdirSync(join(ws, "scripts"), { recursive: true });

for (const c of CAST) {
  if (hasCast(ws, c.name) && process.argv.includes("--skip-existing")) {
    console.log("SKIP", c.name);
    continue;
  }
  console.log("TRIP0", c.name);
  const dest = runTripo(ws, c.prompt, c.name);
  console.log("OK", dest, statSync(dest).size);
}

copyFileSync(join(templatesRoot, "scripts/lab-plaza.py"), join(ws, "scripts/lab-plaza.py"));
const cfg = loadConfig();
const r = spawnSync(cfg.blenderBin, blenderArgs(join(ws, "scripts/lab-plaza.py")), {
  cwd: ws,
  encoding: "utf8",
  env: blenderEnv(),
  timeout: 300_000,
});
if (r.status !== 0) {
  throw new Error((r.stderr || r.stdout || `blender ${r.status}`).slice(0, 5000));
}
const glb = join(ws, "exports/lab-plaza.glb");
if (!existsSync(glb)) throw new Error("plaza glb missing");
const dest = commitModel(ws, "plaza", glb);
console.log("PLAZA", dest, statSync(dest).size);
