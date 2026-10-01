import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadConfig, writeIsolatedCodexHome } from "./codex-home.ts";
import { AgentSession } from "./session.ts";
import { seedWorkspace, repoRoot } from "./workspace.ts";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  return fallback;
}

const fake = process.argv.includes("--fake");
const prompt = arg("--prompt", "列出这个目录里的文件，特别是 AGENTS.md");
const workspace = arg("--cwd", join(repoRoot, "tmp-ws"))!;

seedWorkspace(workspace);
mkdirSync(join(workspace, ".lab"), { recursive: true });

const cfg = loadConfig();
writeIsolatedCodexHome(cfg);

const fakeBin = join(dirname(fileURLToPath(import.meta.url)), "fake-appserver.ts");
const command = fake ? "tsx" : "codex";
const args = fake ? [fakeBin] : ["app-server", "--listen", "stdio://"];

const events: string[] = [];
const session = new AgentSession({
  workspace,
  command,
  args,
  env: {
    ...process.env,
    CODEX_HOME: cfg.codexHome,
    OPENAI_API_KEY: cfg.apiKey,
    OPENAI_BASE_URL: cfg.baseUrl,
  },
  rpcLogPath: join(workspace, ".lab/rpc.jsonl"),
  model: fake ? undefined : cfg.model,
  approvalPolicy: cfg.approvalPolicy,
  autoApprove: true,
  events: {
    onText: (t) => {
      events.push(t);
      console.log("TEXT:", t);
    },
    onTool: (info) => console.log("TOOL:", info.command),
    onTurnDone: (s) => console.log("TURN:", s),
    onTurnError: (m) => console.error("ERROR:", m),
    onModelReady: (p) => console.log("MODEL:", p),
  },
});

const init = await session.start();
console.log("INIT:", JSON.stringify(init));
console.log("THREAD:", session.threadId);
const { turnId } = await session.send(prompt ?? "");
console.log("TURN_ID:", turnId);

await new Promise((r) => setTimeout(r, fake ? 500 : 30_000));
await session.stop();
