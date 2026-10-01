import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadDotenv } from "./dotenv.ts";
import { runTripo } from "./run-tripo.ts";
import { repoRoot, seedWorkspace } from "./workspace.ts";

loadDotenv();
const ws = join(repoRoot, "tmp-ws");
seedWorkspace(ws);
mkdirSync(join(ws, ".lab"), { recursive: true });
const dest = runTripo(ws, "a cute low poly fox, simple");
const n = statSync(dest).size;
if (n < 200) throw new Error(`tripo glb too small: ${n} ${dest}`);
console.log("TRIPO_OK", dest, n);
