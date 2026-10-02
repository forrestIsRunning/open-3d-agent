import assert from "node:assert/strict";
import test from "node:test";
import { blenderArgs, labProxyEnv } from "./spawn-paths.ts";

test("T-proxy-env defaults", () => {
  const e = labProxyEnv();
  assert.match(e.http_proxy, /127\.0\.0\.1:1087/);
  assert.match(e.ALL_PROXY, /socks5:\/\/127\.0\.0\.1:1080/);
});

test("blender args stay headless", () => {
  const a = blenderArgs("/tmp/scripts/lab-cube.py");
  assert.ok(a.includes("--factory-startup"));
  assert.ok(a.includes("--background"));
});
