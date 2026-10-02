import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveWorkspaceGlb } from "./run-transform.ts";

test("T-transform rejects escape", () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-xf-"));
  assert.throws(() => resolveWorkspaceGlb(ws, "../evil.glb"));
  assert.throws(() => resolveWorkspaceGlb(ws, "/tmp/lab-cat_1.glb"));
  assert.throws(() => resolveWorkspaceGlb(ws, "lab-cat_1.glb"));
});
