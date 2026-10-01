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
