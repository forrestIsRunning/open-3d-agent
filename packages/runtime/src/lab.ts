import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, writeIsolatedCodexHome } from "./codex-home.ts";
import { AgentSession } from "./session.ts";
import { seedWorkspace, repoRoot } from "./workspace.ts";
import { loadDotenv } from "./dotenv.ts";
import { fakeServerFile, nodeBin, sessionEnv, tsxCli } from "./spawn-paths.ts";

loadDotenv();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  return fallback;
}

const fake = process.argv.includes("--fake");
const prompt = arg("--prompt", "列出这个目录里的文件，特别是 AGENTS.md");
const timeoutRaw = Number(arg("--timeout", fake ? "2000" : "120000"));
const timeoutMs = timeoutRaw > 0 && timeoutRaw < 1000 ? timeoutRaw * 1000 : timeoutRaw;
const workspace = arg("--cwd", join(repoRoot, "tmp-ws"))!;

const cfg = loadConfig();
seedWorkspace(workspace, cfg.blenderBin);
mkdirSync(join(workspace, ".lab"), { recursive: true });
writeIsolatedCodexHome(cfg);

if (!fake && !cfg.apiKey) {
  throw new Error("OPENAI_API_KEY missing; copy .env.example to .env or pass --fake");
}

let done = false;
const session = new AgentSession({
  workspace,
  command: fake ? nodeBin() : "codex",
  args: fake ? [tsxCli(), fakeServerFile()] : ["app-server", "--listen", "stdio://"],
  env: sessionEnv(process.env, {
    CODEX_HOME: cfg.codexHome,
    OPENAI_API_KEY: cfg.apiKey,
    OPENAI_BASE_URL: cfg.baseUrl,
    BLENDER_BIN: cfg.blenderBin,
  }),
  rpcLogPath: join(workspace, ".lab/rpc.jsonl"),
  model: fake ? undefined : cfg.model,
  approvalPolicy: cfg.approvalPolicy,
  autoApprove: cfg.approvalPolicy === "never",
  events: {
    onText: (t) => console.log("TEXT:", t),
    onTool: (info) => console.log("TOOL:", info.command),
    onTurnDone: (s) => {
      console.log("TURN:", s);
      done = true;
    },
    onTurnError: (m) => {
      console.error("ERROR:", m);
      done = true;
    },
    onModelReady: (p) => console.log("MODEL:", p),
  },
});

const init = await session.start();
console.log("FAKE:", fake);
console.log("INIT:", JSON.stringify(init));
console.log("THREAD:", session.threadId);
const { turnId } = await session.send(prompt ?? "");
console.log("TURN_ID:", turnId);

const start = Date.now();
while (!done && Date.now() - start < timeoutMs) {
  await new Promise((r) => setTimeout(r, 200));
}
if (!done) console.error("ERROR: turn timed out");
await session.stop();
if (!done) process.exit(1);
