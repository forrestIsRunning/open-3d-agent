import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveLabScript } from "./run-blender.ts";

test("T-tool-blender-script rejects escape", () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-"));
  assert.throws(() => resolveLabScript(ws, "../evil.py"));
  assert.throws(() => resolveLabScript(ws, "/tmp/x.py"));
  assert.match(resolveLabScript(ws, "scripts/lab-cube.py"), /lab-cube\.py$/);
});
