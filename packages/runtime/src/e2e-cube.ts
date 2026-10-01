import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadDotenv } from "./dotenv.ts";
import { runCube } from "./run-cube.ts";
import { repoRoot, seedWorkspace } from "./workspace.ts";

loadDotenv();
const ws = join(repoRoot, "tmp-ws");
seedWorkspace(ws);
mkdirSync(join(ws, ".lab"), { recursive: true });
const dest = runCube(ws);
const n = statSync(dest).size;
if (n < 200) throw new Error(`cube glb too small: ${n} ${dest}`);
console.log("CUBE_OK", dest, n);
