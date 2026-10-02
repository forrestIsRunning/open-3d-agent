import assert from "node:assert/strict";
import test from "node:test";
import { classifyIntent } from "./intent.ts";

test("T-intent generate puppy", () => {
  assert.equal(classifyIntent("帮我生成一个小狗的3d model").kind, "generate");
  const g = classifyIntent("帮我生成一个小狗的3d model");
  assert.equal(g.kind, "generate");
  if (g.kind === "generate") assert.equal(g.name, "puppy");
});

test("T-no-shell-blender in AGENTS.md", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { templatesRoot } = await import("./workspace.ts");
  const md = readFileSync(join(templatesRoot, "AGENTS.md"), "utf8");
  assert.match(md, /Blender\.app/);
  assert.match(md, /workspace_generate_3d/);
  assert.match(md, /workspace_edit_3d/);
  assert.match(md, /workspace_transform_model/);
});

test("T-intent chat vs cube vs lamb", () => {
  assert.equal(classifyIntent("介绍一下自己").kind, "chat");
  assert.equal(classifyIntent("做一个立方体").kind, "blender-cube");
  assert.equal(classifyIntent("帮我做一只小羊").kind, "blender-lamb");
});

test("T-intent edit vs generate vs transform", () => {
  assert.equal(classifyIntent("把衣服改成红色").kind, "edit");
  assert.equal(classifyIntent("耳朵更尖一点").kind, "edit");
  assert.equal(classifyIntent("对齐地面").kind, "blender-transform");
  const h = classifyIntent("身高 1.7 米");
  assert.equal(h.kind, "blender-transform");
  if (h.kind === "blender-transform") {
    assert.equal(h.op, "height");
    assert.equal(h.height, 1.7);
  }
  assert.equal(classifyIntent("帮我生成一个小狗的3d model").kind, "generate");
});
