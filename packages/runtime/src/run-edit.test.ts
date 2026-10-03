import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseAssetName } from "@lab3d/protocol";
import { runEdit3d } from "./run-edit.ts";
import { cancelActiveJob } from "./run-tripo.ts";

test("T-edit stub commits next family version", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-edit-"));
  writeFileSync(join(ws, "lab-cat_1.glb"), "glTF-stub");
  mkdirSync(join(ws, ".lab/thumbs"), { recursive: true });
  writeFileSync(join(ws, ".lab/thumbs/lab-cat_1.png"), "png");
  process.env.LAB_TRIPO_STUB = "1";
  let concept = "";
  const dest = await runEdit3d(ws, {
    prompt: "red coat",
    family: "cat",
    onConcept: (rel) => {
      concept = rel;
    },
  });
  assert.equal(parseAssetName(dest).family, "cat");
  assert.equal(parseAssetName(dest).version, 2);
  assert.equal(concept, ".lab/concepts/cat.png");
});

test("T-edit needs image", async () => {
  const ws = mkdtempSync(join(tmpdir(), "lab3d-edit2-"));
  writeFileSync(join(ws, "lab-cat_1.glb"), "glTF-stub");
  process.env.LAB_TRIPO_STUB = "1";
  await assert.rejects(() => runEdit3d(ws, { prompt: "red", family: "cat" }), /viewport|reference/);
});

test("cancel with no tripo child is a no-op", () => {
  assert.equal(cancelActiveJob(), false);
});
