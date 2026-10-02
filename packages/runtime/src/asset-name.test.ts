import assert from "node:assert/strict";
import test from "node:test";
import { parseAssetName } from "@lab3d/protocol";

test("parseAssetName puppy v3", () => {
  const p = parseAssetName("lab-puppy_3.glb");
  assert.equal(p.family, "puppy");
  assert.equal(p.version, 3);
  assert.equal(p.label, "puppy · v3");
});
