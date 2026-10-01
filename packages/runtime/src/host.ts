/**
 * Desktop envelope JSONL on stdin/stdout. Spawns Codex or fake app-server.
 */
import { createInterface } from "node:readline";
import { join } from "node:path";
import { EnvelopeEventMethod, EnvelopeMethod } from "@lab3d/protocol";
import { AgentSession } from "./session.ts";
import { loadConfig, writeIsolatedCodexHome } from "./codex-home.ts";
import { seedWorkspace } from "./workspace.ts";
import { commitModel } from "./commit-model.ts";
import { fileURLToPath } from "node:url";
import { dirname as pathDirname } from "node:path";

function emit(method: string, params: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function reply(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

let session: AgentSession | null = null;
let workspace = "";

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  const msg = JSON.parse(line) as { id: unknown; method: string; params?: Record<string, unknown> };
  try {
    const result = await handle(msg.method, msg.params ?? {});
    reply(msg.id, result);
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
      }) + "\n",
    );
  }
});

async function handle(method: string, params: Record<string, unknown>): Promise<unknown> {
  if (method === EnvelopeMethod.workspaceOpen) {
    workspace = String(params.path);
    seedWorkspace(workspace);
    return { workspace };
  }
  if (method === EnvelopeMethod.runtimeStart) {
    const cfg = loadConfig();
    writeIsolatedCodexHome(cfg);
    const fake = Boolean(params.fake);
    const fakeBin = join(pathDirname(fileURLToPath(import.meta.url)), "fake-appserver.ts");
    session = new AgentSession({
      workspace,
      command: fake ? "tsx" : "codex",
      args: fake ? [fakeBin] : ["app-server", "--listen", "stdio://"],
      env: { ...process.env, CODEX_HOME: cfg.codexHome, OPENAI_API_KEY: cfg.apiKey },
      rpcLogPath: join(workspace, ".lab/rpc.jsonl"),
      model: fake ? undefined : cfg.model,
      approvalPolicy: cfg.approvalPolicy,
      autoApprove: cfg.approvalPolicy === "never",
      events: {
        onText: (text) => emit(EnvelopeEventMethod.agentText, { text }),
        onTool: (info) => emit(EnvelopeEventMethod.agentTool, info),
        onTurnDone: (status) => emit(EnvelopeEventMethod.turnDone, { status }),
        onTurnError: (message) => emit(EnvelopeEventMethod.turnError, { message }),
        onApproval: (id, m, p) => emit(EnvelopeEventMethod.approvalNeeded, { id, method: m, params: p }),
        onUserInput: (id, p) => emit(EnvelopeEventMethod.userInputNeeded, { id, params: p }),
        onModelReady: (path) => emit(EnvelopeEventMethod.modelReady, { path }),
      },
    });
    const init = await session.start();
    return { init, threadId: session.threadId };
  }
  if (method === EnvelopeMethod.turnSend) {
    if (!session) throw new Error("runtime not started");
    return await session.send(String(params.text ?? ""));
  }
  if (method === EnvelopeMethod.turnInterrupt) {
    if (!session) throw new Error("runtime not started");
    await session.interrupt(String(params.turnId));
    return {};
  }
  if (method === EnvelopeMethod.approvalRespond) {
    session?.resolvePending(String(params.id), params.result ?? { decision: "decline" });
    return {};
  }
  if (method === EnvelopeMethod.userInputRespond) {
    session?.resolvePending(String(params.id), params.result ?? { answers: {} });
    return {};
  }
  if (method === EnvelopeMethod.commitModel) {
    const dest = commitModel(workspace, String(params.name), String(params.exportPath));
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.runtimeStop) {
    await session?.stop();
    session = null;
    return {};
  }
  throw new Error(`unknown method ${method}`);
}
