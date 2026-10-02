/**
 * Minimal Codex app-server stand-in for CI.
 * Speaks the same JSON-RPC subset as packages/protocol/src/methods.ts
 */
import { createInterface } from "node:readline";
import { ClientMethod, ClientNotify, ServerMethod, ServerNotify, HostTool } from "@lab3d/protocol";

const mode = process.env.FAKE_MODE ?? "happy";

function write(obj: object): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function respond(id: unknown, result: unknown): void {
  write({ jsonrpc: "2.0", id, result });
}

function notify(method: string, params: unknown): void {
  write({ jsonrpc: "2.0", method, params });
}

const thread = {
  id: "thread-lab-1",
  sessionId: "session-1",
  preview: "",
  ephemeral: true,
  historyMode: "default",
  modelProvider: "fake",
  model: "fake-model",
  createdAt: 1,
  updatedAt: 1,
  status: { type: "idle" },
  cwd: process.cwd(),
  cliVersion: "fake",
  source: "app-server",
  canAcceptDirectInput: true,
  turns: [],
  forkedFromId: null,
  parentThreadId: null,
  extra: null,
  environments: [],
  section: null,
  sectionEnteredAt: null,
  projectId: null,
  reasoningEffort: null,
  recencyAt: null,
  path: null,
  originator: "fake",
  threadSource: null,
  agentNickname: null,
  agentRole: null,
  gitInfo: null,
  name: null,
  daybreakEnabled: null,
};

let initialized = false;
let nextTurn = 1;
let pendingTurn: { threadId: string; turnId: string } | null = null;

function finishHappy(threadId: string, turnId: string, text = "AGENTS.md is in this workspace."): void {
  notify(ServerNotify.itemCompleted, {
    threadId,
    turnId,
    completedAtMs: Date.now(),
    item: {
      type: "agentMessage",
      id: "item-1",
      text,
      phase: null,
      memoryCitation: null,
      delivery: null,
      questions: null,
    },
  });
  notify(ServerNotify.turnCompleted, {
    threadId,
    turn: { id: turnId, status: "completed", error: null },
  });
}

function finishFail(threadId: string, turnId: string, message: string): void {
  notify(ServerNotify.turnCompleted, {
    threadId,
    turn: { id: turnId, status: "failed", error: { message } },
  });
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line) as {
    jsonrpc: string;
    id?: number | string;
    method?: string;
    params?: Record<string, unknown>;
    result?: { decision?: string };
  };
  if (!msg.method && msg.id != null && pendingTurn) {
    const decision = String(msg.result?.decision ?? "");
    const { threadId, turnId } = pendingTurn;
    pendingTurn = null;
    if (decision === "accept" || decision === "acceptForSession") {
      finishHappy(threadId, turnId, "command allowed");
    } else {
      finishFail(threadId, turnId, "command declined");
    }
    return;
  }
  if (!msg.method) return;
  if (msg.method === ClientMethod.initialize) {
    respond(msg.id, {
      userAgent: "fake-appserver/0.1",
      codexHome: process.cwd(),
      platformFamily: "unix",
      platformOs: "macos",
    });
    return;
  }
  if (msg.method === ClientNotify.initialized) {
    initialized = true;
    return;
  }
  if (!initialized) {
    write({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: "not initialized" } });
    return;
  }
  if (msg.method === ClientMethod.threadResume) {
    const id = String(msg.params?.threadId ?? thread.id);
    thread.id = id;
    respond(msg.id, {
      thread,
      model: "fake-model",
      modelProvider: "fake",
      serviceTier: null,
      disabledPluginIds: [],
      cwd: process.cwd(),
      runtimeWorkspaceRoots: [],
      instructionSources: [],
      approvalPolicy: "never",
      approvalsReviewer: "owner",
      sandbox: { type: "workspaceWrite" },
      activePermissionProfile: null,
      reasoningEffort: null,
      multiAgentMode: "explicitRequestOnly",
    });
    return;
  }
  if (msg.method === ClientMethod.threadStart) {
    respond(msg.id, {
      thread,
      model: "fake-model",
      modelProvider: "fake",
      serviceTier: null,
      disabledPluginIds: [],
      cwd: process.cwd(),
      runtimeWorkspaceRoots: [],
      instructionSources: [],
      approvalPolicy: "never",
      approvalsReviewer: "owner",
      sandbox: { type: "workspaceWrite" },
      activePermissionProfile: null,
      reasoningEffort: null,
      multiAgentMode: "explicitRequestOnly",
    });
    notify(ServerNotify.threadStarted, { thread });
    return;
  }
  if (msg.method === ClientMethod.turnStart) {
    const turnId = `turn-${nextTurn++}`;
    const threadId = String(msg.params?.threadId ?? thread.id);
    respond(msg.id, {
      turn: {
        id: turnId,
        items: [],
        itemsView: "full",
        status: "inProgress",
        error: null,
        startedAt: 1,
        completedAt: null,
        durationMs: null,
      },
    });
    notify(ServerNotify.turnStarted, { threadId, turn: { id: turnId, status: "inProgress" } });

    if (mode === "approval") {
      pendingTurn = { threadId, turnId };
      write({
        jsonrpc: "2.0",
        id: "srv-approval-1",
        method: ServerMethod.commandApproval,
        params: { command: "echo hi", cwd: process.cwd() },
      });
      return;
    }
    if (mode === "user-input") {
      write({
        jsonrpc: "2.0",
        id: "srv-input-1",
        method: ServerMethod.requestUserInput,
        params: {
          threadId,
          turnId,
          itemId: "q1",
          questions: [{ id: "q1", header: "Name", question: "Model name?", isOther: false, isSecret: false, options: [] }],
        },
      });
      return;
    }
    if (mode === "tool-call") {
      write({
        jsonrpc: "2.0",
        id: "srv-tool-1",
        method: ServerMethod.toolCall,
        params: {
          threadId,
          turnId,
          callId: "call-1",
          namespace: null,
          tool: HostTool.commitModel,
          arguments: { name: "cube", exportPath: "exports/cube.glb" },
        },
      });
      return;
    }
    if (mode === "generate-tool") {
      write({
        jsonrpc: "2.0",
        id: "srv-tool-gen",
        method: ServerMethod.toolCall,
        params: {
          threadId,
          turnId,
          callId: "call-gen",
          namespace: null,
          tool: HostTool.generate3d,
          arguments: { prompt: "a puppy", name: "puppy" },
        },
      });
      return;
    }

    notify(ServerNotify.itemCompleted, {
      threadId,
      turnId,
      completedAtMs: Date.now(),
      item: {
        type: "agentMessage",
        id: "item-1",
        text: "AGENTS.md is in this workspace.",
        phase: null,
        memoryCitation: null,
        delivery: null,
        questions: null,
      },
    });
    notify(ServerNotify.turnCompleted, {
      threadId,
      turn: { id: turnId, status: "completed", error: null },
    });
    return;
  }
  if (msg.method === ClientMethod.turnInterrupt) {
    respond(msg.id, {});
    return;
  }
});
