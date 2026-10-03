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
import { listAssets } from "./assets.ts";
import { runBlenderScript } from "./run-blender.ts";
import { runCube, runLamb } from "./run-cube.ts";
import { runEdit3d } from "./run-edit.ts";
import { runFillHoles } from "./run-repair.ts";
import { runTransform } from "./run-transform.ts";
import { runTripo } from "./run-tripo.ts";
import { openLabDb, type LabDb } from "./lab-db.ts";

loadDotenv();

function emit(method: string, params: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function progress(step: string, hint: string): void {
  emit(EnvelopeEventMethod.jobProgress, { step, hint });
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
        sessionId: db?.currentSessionId(),
        sessions: db?.listSessions() ?? [],
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
    const cur = db.currentSessionId();
    if (cur) db.bindThread(cur, session.threadId);
    else db.createSession(session.threadId, "Chat");
    return {
      init,
      threadId: session.threadId,
      fake,
      model: cfg.model,
      approvalPolicy: cfg.approvalPolicy,
      messages: db.listMessages(),
      lastAsset: db.getMeta("lastAsset"),
      sessionId: db.currentSessionId(),
      sessions: db.listSessions(),
    };
  }
  if (method === EnvelopeMethod.sessionList) {
    if (!db) throw new Error("workspace not open");
    return {
      sessionId: db.currentSessionId(),
      sessions: db.listSessions(),
      messages: db.listMessages(),
      lastAsset: db.getMeta("lastAsset"),
      threadId: db.getMeta("threadId"),
    };
  }
  if (method === EnvelopeMethod.sessionAppend) {
    if (!db) throw new Error("workspace not open");
    const role = String(params.role ?? "user");
    const text = String(params.text ?? "").trim();
    if (text) db.addMessage(role, text);
    return { sessionId: db.currentSessionId(), sessions: db.listSessions() };
  }
  if (method === EnvelopeMethod.sessionNew) {
    if (!session || !db) throw new Error("runtime not started");
    const threadId = await session.newThread();
    const created = db.createSession(threadId, "New chat");
    return {
      threadId,
      sessionId: created.id,
      sessions: db.listSessions(),
      messages: [] as unknown[],
    };
  }
  if (method === EnvelopeMethod.sessionOpen) {
    if (!session || !db) throw new Error("runtime not started");
    const opened = db.openSession(Number(params.id));
    const threadId = opened.threadId
      ? await session.resumeThread(opened.threadId)
      : await session.newThread();
    db.bindThread(opened.id, threadId);
    return {
      threadId,
      sessionId: opened.id,
      sessions: db.listSessions(),
      messages: db.listMessages(opened.id),
    };
  }
  if (method === EnvelopeMethod.turnSend) {
    if (!session) throw new Error("runtime not started");
    const text = String(params.text ?? "");
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
    progress("Blender · cube", "Headless lab-cube.py; a few seconds.");
    const dest = runCube(workspace);
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.runLamb) {
    progress("Blender · lamb", "Headless lab-lamb.py; a few seconds.");
    const dest = runLamb(workspace);
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.runTripo) {
    progress("Tripo · text-to-3D", "Host is calling tripo make. Often 1–3 minutes.");
    const dest = runTripo(workspace, String(params.prompt ?? "a cute low poly fox"), String(params.name ?? "fox"));
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.generate3d) {
    const fromImage = Boolean(params.imagePath);
    progress(
      fromImage ? "Tripo · image-to-3D" : "Tripo · text-to-3D",
      fromImage
        ? "Host is meshing from the attached image. Often 1–3 minutes."
        : "Host is calling tripo make. The current mesh stays on stage until the new GLB lands.",
    );
    const dest = runTripo(
      workspace,
      String(params.prompt ?? "a 3d model"),
      String(params.name ?? "gen"),
      params.imagePath ? String(params.imagePath) : undefined,
    );
    progress("Commit GLB", "Writing the next lab-<name>_N.glb.");
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.edit3d) {
    progress("Tripo · image-to-image", "Restyling a concept from the condition shot.");
    const dest = runEdit3d(workspace, {
      prompt: String(params.prompt ?? ""),
      family: String(params.family ?? ""),
      imagePath: params.imagePath ? String(params.imagePath) : undefined,
      onConcept: (rel) => {
        emit(EnvelopeEventMethod.editConcept, { path: rel, family: params.family });
        progress("Tripo · image-to-3D", "Concept is ready. Meshing the next version of this family.");
      },
    });
    progress("Commit GLB", "Writing the next family version.");
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.transformModel) {
    const op = (params.op as "ground" | "height" | "yaw") ?? "ground";
    progress(`Blender · ${op}`, "Headless pose/scale on the current GLB.");
    const dest = runTransform(workspace, {
      source: String(params.source ?? ""),
      op,
      height: params.height != null ? Number(params.height) : undefined,
      yaw: params.yaw != null ? Number(params.yaw) : undefined,
    });
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.runPlaza) {
    progress("Blender · plaza", "Composing scaled lab-*.glb files into one scene.");
    const dest = runBlenderScript(workspace, "lab-plaza.py", "plaza");
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.fillHoles) {
    progress("Blender · fill holes", "Closing unintended holes on the current GLB.");
    const dest = runFillHoles(workspace, String(params.source ?? ""));
    emit(EnvelopeEventMethod.modelReady, { path: dest });
    return { path: dest };
  }
  if (method === EnvelopeMethod.listAssets) {
    return { names: listAssets(workspace) };
  }
  if (method === EnvelopeMethod.runtimeStop) {
    await session?.stop();
    session = null;
    return {};
  }
  throw new Error(`unknown method ${method}`);
}
