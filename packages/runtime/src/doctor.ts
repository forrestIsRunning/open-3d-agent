import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "./workspace.ts";
import { loadConfig, writeIsolatedCodexHome } from "./codex-home.ts";

const pinned = readFileSync(join(repoRoot, "CODEX_VERSION"), "utf8").trim();
const cfg = loadConfig();
writeIsolatedCodexHome(cfg);

const checks: Array<[string, boolean, string]> = [];

const codex = spawnSync("codex", ["--version"], { encoding: "utf8" });
const version = (codex.stdout || "").trim();
checks.push(["codex", version.includes(pinned), `want ${pinned}, got ${version || codex.stderr}`]);
checks.push(["blender", existsSync(cfg.blenderBin), cfg.blenderBin]);
checks.push(["codex-home", existsSync(cfg.codexHome), cfg.codexHome]);
checks.push(["api-key", cfg.apiKey.length > 0, cfg.apiKey ? "set" : "OPENAI_API_KEY missing (ok for --fake)"]);

const tripo = spawnSync("tripo", ["whoami"], { encoding: "utf8" });
checks.push(["tripo", tripo.status === 0, (tripo.stdout || tripo.stderr || "tripo missing").slice(0, 120)]);

let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? "ok" : "FAIL"}  ${name}: ${detail}`);
  if (!ok && name !== "api-key" && name !== "tripo") failed += 1;
}
process.exit(failed === 0 ? 0 : 1);
