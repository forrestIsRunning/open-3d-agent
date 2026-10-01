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
import { loadDotenv } from "./dotenv.ts";
import { fakeServerFile, nodeBin, sessionEnv, tsxCli } from "./spawn-paths.ts";
import { runCube, runLamb } from "./run-cube.ts";
import { runTripo } from "./run-tripo.ts";
import { openLabDb, type LabDb } from "./lab-db.ts";

loadDotenv();

function emit(method: string, params: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function reply(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

let session: AgentSession | null = null;
let workspace = "";
let startedFake = false;
let db: LabDb | null = null;

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
    const cfg = loadConfig();
    workspace = String(params.path);
    seedWorkspace(workspace, cfg.blenderBin);
    db?.close();
    db = openLabDb(workspace);
    return { workspace };
  }
  if (method === EnvelopeMethod.runtimeStart) {
    if (session) {
      return {
        threadId: session.threadId,
        fake: startedFake,
        model: loadConfig().model,
        messages: db?.listMessages() ?? [],
        lastAsset: db?.getMeta("lastAsset"),
      };
    }
    const cfg = loadConfig();
    writeIsolatedCodexHome(cfg);
    startedFake = Boolean(params.fake);
    const fake = startedFake;
    if (!db) db = openLabDb(workspace);
    session = new AgentSession({
      workspace,
      command: fake ? nodeBin() : "codex",
      args: fake ? [tsxCli(), fakeServerFile()] : ["app-server", "--listen", "stdio://"],
      env: sessionEnv(process.env, {
        CODEX_HOME: cfg.codexHome,
        OPENAI_API_KEY: cfg.apiKey,
        OPENAI_BASE_URL: cfg.baseUrl,
        BLENDER_BIN: cfg.blenderBin,
        ELECTRON_RUN_AS_NODE: fake ? "1" : "",
      }),
      rpcLogPath: join(workspace, ".lab/rpc.jsonl"),
      model: fake ? undefined : cfg.model,
      approvalPolicy: cfg.approvalPolicy,
      autoApprove: cfg.approvalPolicy === "never",
      threadId: db.getMeta("threadId"),
      events: {
        onText: (text) => {
          db?.addMessage("agent", text);
          emit(EnvelopeEventMethod.agentText, { text });
        },
        onTool: (info) => {
          const text = JSON.stringify(info);
          db?.addMessage("tool", text);
          emit(EnvelopeEventMethod.agentTool, info);
        },
        onTurnDone: (status) => emit(EnvelopeEventMethod.turnDone, { status }),
        onTurnError: (message) => {
          db?.addMessage("system", message);
          emit(EnvelopeEventMethod.turnError, { message });
        },
        onApproval: (id, m, p) =>
          emit(EnvelopeEventMethod.approvalNeeded, { id, method: m, params: p }),
        onUserInput: (id, p) => emit(EnvelopeEventMethod.userInputNeeded, { id, params: p }),
        onModelReady: (path) => {
          const name = path.split("/").pop() ?? path;
          db?.setMeta("lastAsset", name);
          emit(EnvelopeEventMethod.modelReady, { path });
        },
      },
    });
    const init = await session.start();
    db.setMeta("threadId", session.threadId);
    return {
      init,
      threadId: session.threadId,
      fake,
      model: cfg.model,
      approvalPolicy: cfg.approvalPolicy,
      messages: db.listMessages(),
      lastAsset: db.getMeta("lastAsset"),
    };
  }
  if (method === EnvelopeMethod.turnSend) {
    if (!session) throw new Error("runtime not started");
    const text = String(params.text ?? "");
    db?.addMessage("user", text);
    return await session.send(text);
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
  if (method === EnvelopeMethod.runCube) {
    const dest = runCube(workspace);
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.runLamb) {
    const dest = runLamb(workspace);
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.runTripo) {
    const dest = runTripo(workspace, String(params.prompt ?? "a cute low poly fox"));
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
