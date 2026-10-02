import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import test from "node:test";
import { ClientNotify, HostTool, ServerMethod } from "@lab3d/protocol";
import { AgentSession } from "./session.ts";
import { commitModel, ensurePlaceholderGlb } from "./commit-model.ts";
import { seedWorkspace } from "./workspace.ts";

const fakeBin = join(dirname(fileURLToPath(import.meta.url)), "fake-appserver.ts");

function session(ws: string, env: NodeJS.ProcessEnv = {}): AgentSession {
  return new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    env: { ...process.env, ...env },
    autoApprove: true,
    events: {},
  });
}

test("T-init handshake initialize then initialized", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  const s = session(ws);
  const init = (await s.start()) as { userAgent?: string; platformOs?: string };
  assert.match(String(init.userAgent), /fake-appserver/);
  assert.equal(init.platformOs, "macos");
  await s.stop();
});

test("T-thread thread/start returns id", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  const s = session(ws);
  await s.start();
  assert.equal(s.threadId, "thread-lab-1");
  await s.stop();
});

test("T-turn turn/start yields agentMessage and turn completed", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  let text = "";
  let done = "";
  const s = new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    autoApprove: true,
    events: {
      onText: (t) => {
        text = t;
      },
      onTurnDone: (st) => {
        done = st;
      },
    },
  });
  await s.start();
  const { turnId } = await s.send("list files");
  assert.match(turnId, /^turn-/);
  await new Promise((r) => setTimeout(r, 200));
  assert.match(text, /AGENTS.md/);
  assert.equal(done, "completed");
  await s.stop();
});

test("T-approval auto-accept command approval", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  let done = "";
  const s = new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    env: { ...process.env, FAKE_MODE: "approval" },
    autoApprove: true,
    events: { onTurnDone: (st) => (done = st) },
  });
  await s.start();
  await s.send("run");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(done, "completed");
  await s.stop();
});

test("T-deny declines command and fails turn", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  let err = "";
  let approvalId = "";
  const s = new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    env: { ...process.env, FAKE_MODE: "approval" },
    autoApprove: false,
    events: {
      onApproval: (id) => {
        approvalId = String(id);
        s.resolvePending(String(id), { decision: "decline" });
      },
      onTurnError: (m) => (err = m),
    },
  });
  await s.start();
  await s.send("run");
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(approvalId);
  assert.match(err, /declined/);
  await s.stop();
});

test("T-approval waits until host responds", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  let done = "";
  let approvalId = "";
  const s = new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    env: { ...process.env, FAKE_MODE: "approval" },
    autoApprove: false,
    events: {
      onApproval: (id) => {
        approvalId = String(id);
      },
      onTurnDone: (st) => {
        done = st;
      },
    },
  });
  await s.start();
  await s.send("run");
  await new Promise((r) => setTimeout(r, 250));
  assert.ok(approvalId);
  assert.equal(done, "");
  s.resolvePending(approvalId, { decision: "accept" });
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(done, "completed");
  await s.stop();
});

test("T-user-input auto empty answers", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  const s = session(ws, { FAKE_MODE: "user-input" });
  await s.start();
  await s.send("ask");
  await new Promise((r) => setTimeout(r, 200));
  await s.stop();
});

test("T-tool-call commitModel copies glb", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  ensurePlaceholderGlb(ws, "exports/cube.glb");
  let ready = "";
  const s = new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    env: { ...process.env, FAKE_MODE: "tool-call" },
    autoApprove: true,
    events: { onModelReady: (p) => (ready = p) },
  });
  await s.start();
  await s.send("commit");
  await new Promise((r) => setTimeout(r, 200));
  assert.match(ready, /lab-cube_1\.glb$/);
  await s.stop();
});

test("commitModel increments versions", () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  const src = join(ws, "a.glb");
  writeFileSync(src, "glTF");
  const a = commitModel(ws, "cube", src);
  const b = commitModel(ws, "cube", src);
  assert.match(a, /lab-cube_1\.glb$/);
  assert.match(b, /lab-cube_2\.glb$/);
});

test("T-tool-generate stub tripo emits model.ready", async () => {
  process.env.LAB_TRIPO_STUB = "1";
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  let ready = "";
  const s = new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    env: { ...process.env, FAKE_MODE: "generate-tool", LAB_TRIPO_STUB: "1" },
    autoApprove: true,
    events: { onModelReady: (p) => (ready = p) },
  });
  await s.start();
  await s.send("puppy");
  await new Promise((r) => setTimeout(r, 250));
  assert.match(ready, /lab-puppy_1\.glb$/);
  await s.stop();
});

test("T-optout OptOutDeltas exported", async () => {
  const { OptOutDeltas } = await import("@lab3d/protocol");
  assert.ok(OptOutDeltas.includes("item/agentMessage/delta"));
});

void ClientNotify;
void HostTool;
void ServerMethod;
