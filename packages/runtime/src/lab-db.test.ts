import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openLabDb } from "./lab-db.ts";
import { AgentSession } from "./session.ts";
import { seedWorkspace } from "./workspace.ts";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const fakeBin = join(dirname(fileURLToPath(import.meta.url)), "fake-appserver.ts");

test("sqlite keeps messages across reopen", () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-db-"));
  const a = openLabDb(ws);
  a.addMessage("user", "hello");
  a.setMeta("threadId", "thread-lab-1");
  a.close();
  const b = openLabDb(ws);
  assert.equal(b.getMeta("threadId"), "thread-lab-1");
  assert.equal(b.listMessages()[0]?.text, "hello");
  b.close();
});

test("sessions isolate messages", () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-sess-"));
  const db = openLabDb(ws);
  db.addMessage("user", "hello husky");
  const first = db.currentSessionId();
  const next = db.createSession("thread-b", "New chat");
  assert.notEqual(next.id, first);
  assert.equal(db.listMessages().length, 0);
  db.addMessage("user", "new topic");
  assert.equal(db.listMessages().length, 1);
  db.openSession(first);
  assert.match(db.listMessages()[0]?.text ?? "", /hello husky/);
  db.close();
});

test("session list snapshot keeps transcript", () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-snap-"));
  const db = openLabDb(ws);
  db.addMessage("user", "hi");
  db.addMessage("agent", "**v2**");
  const rows = db.listMessages();
  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.text, "**v2**");
  db.close();
  const again = openLabDb(ws);
  assert.equal(again.listMessages().length, 2);
  again.close();
});

test("T-resume fake thread/resume by stored id", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  seedWorkspace(ws);
  const s = new AgentSession({
    workspace: ws,
    command: "tsx",
    args: [fakeBin],
    autoApprove: true,
    threadId: "thread-from-sqlite",
  });
  await s.start();
  assert.equal(s.threadId, "thread-from-sqlite");
  await s.stop();
});
