import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseAssetName } from "@lab3d/protocol";
import { loadDotenv } from "./dotenv.ts";
import { runCube } from "./run-cube.ts";
import { runFillHoles } from "./run-repair.ts";
import { repoRoot, seedWorkspace } from "./workspace.ts";

loadDotenv();
const ws = join(repoRoot, "tmp-ws");
seedWorkspace(ws);
mkdirSync(join(ws, ".lab"), { recursive: true });
const cube = runCube(ws);
const dest = runFillHoles(ws, cube);
const n = statSync(dest).size;
if (n < 200) throw new Error(`fill-holes glb too small: ${n}`);
if (parseAssetName(dest).family !== parseAssetName(cube).family) {
  throw new Error(`family mismatch ${dest}`);
}
console.log("FILL_HOLES_OK", dest, n);
