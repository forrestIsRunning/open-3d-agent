#!/usr/bin/env node
/**
 * Download a complete Electron dist. Honors http_proxy/https_proxy.
 * Do not set ALL_PROXY=socks5:// — @electron/get then throws Invalid NO_PROXY.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "apps/desktop/package.json"), "utf8"));
const spec = pkg.devDependencies.electron.replace(/^[^\d]*/, "");
const version = spec;
const platform = process.platform === "darwin" ? "darwin" : process.platform;
const arch = process.arch === "arm64" ? "arm64" : "x64";
const zipName = `electron-v${version}-${platform}-${arch}.zip`;
const url = `https://github.com/electron/electron/releases/download/v${version}/${zipName}`;

const electronDir = join(
  root,
  "node_modules/.pnpm",
);
let destPkg = join(root, "node_modules/electron");
if (!existsSync(join(destPkg, "package.json"))) {
  destPkg = join(root, "apps/desktop/node_modules/electron");
}
// Prefer the real pnpm store path via require.resolve if possible
try {
  const resolved = execSync("node -p \"require.resolve('electron/package.json')\"", {
    cwd: join(root, "apps/desktop"),
    encoding: "utf8",
  }).trim();
  destPkg = dirname(resolved);
} catch {
  /* keep destPkg */
}

const dist = join(destPkg, "dist");
const framework =
  platform === "darwin"
    ? join(dist, "Electron.app/Contents/Frameworks/Electron Framework.framework")
    : join(dist, "electron");
if (existsSync(framework)) {
  const pathTxt = platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron";
  writeFileSync(join(destPkg, "path.txt"), pathTxt);
  console.log("electron already installed", destPkg);
  process.exit(0);
}

const cache = join(homedir(), ".cache/lab3d-electron");
mkdirSync(cache, { recursive: true });
const zip = join(cache, zipName);
const proxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || "";
const curl = ["curl", "-L", "--fail", "-o", zip, url];
if (proxy) curl.splice(1, 0, "--proxy", proxy);
console.log("downloading", url);
execSync(curl.map((c) => (c.includes(" ") ? `"${c}"` : c)).join(" "), { stdio: "inherit" });
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
execSync(`unzip -o -q ${JSON.stringify(zip)} -d ${JSON.stringify(dist)}`, { stdio: "inherit" });
if (!existsSync(framework)) {
  throw new Error(`electron extract missing framework at ${framework}`);
}
const pathTxt = platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron";
writeFileSync(join(destPkg, "path.txt"), pathTxt);
console.log("electron installed", destPkg);
void electronDir;
