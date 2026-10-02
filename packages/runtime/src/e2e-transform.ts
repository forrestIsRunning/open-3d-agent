import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseAssetName } from "@lab3d/protocol";
import { loadDotenv } from "./dotenv.ts";
import { runCube } from "./run-cube.ts";
import { runTransform } from "./run-transform.ts";
import { repoRoot, seedWorkspace } from "./workspace.ts";

loadDotenv();
const ws = join(repoRoot, "tmp-ws");
seedWorkspace(ws);
mkdirSync(join(ws, ".lab"), { recursive: true });
const cube = runCube(ws);
const dest = runTransform(ws, { source: cube, op: "ground" });
const n = statSync(dest).size;
if (n < 200) throw new Error(`transform glb too small: ${n} ${dest}`);
if (parseAssetName(dest).family !== parseAssetName(cube).family) {
  throw new Error(`family mismatch ${dest} vs ${cube}`);
}
console.log("TRANSFORM_OK", dest, n);
