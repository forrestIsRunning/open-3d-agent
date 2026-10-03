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
  assert.match(md, /workspace_fill_holes/);
  assert.match(md, /workspace_run_plaza/);
  assert.match(md, /compact Markdown/);
  assert.match(md, /menu of features/);
});

test("T-intent chat vs cube vs lamb", () => {
  assert.equal(classifyIntent("介绍一下自己").kind, "chat");
  assert.equal(classifyIntent("做一个立方体").kind, "blender-cube");
  assert.equal(classifyIntent("帮我做一只小羊").kind, "blender-lamb");
});

test("T-intent talk about the stage is chat, not generate", () => {
  const talk = [
    "你好。帮我介绍一下这个模型。",
    "你看看现在的3d model。给介绍一下",
    "介绍一下这个模型",
    "这个模型是什么",
    "Describe this model",
    "你好。帮我介绍一下这个模型。Provide thorough, detailed responses that explore topics from multiple angles. Include relevant context, examples, nuances, and implications.",
  ];
  for (const line of talk) {
    assert.equal(classifyIntent(line).kind, "chat", line.slice(0, 40));
  }
  assert.equal(classifyIntent("帮我生成一个小狗的3d model").kind, "generate");
  assert.equal(classifyIntent("generate a husky").kind, "generate");
  assert.equal(classifyIntent("make a 3d fox").kind, "generate");
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

test("T-hi3d-quickstarts map to honest intents", () => {
  const rows: Array<[string, string]> = [
    [
      "Create a short story scene with these characters, coordinating their actions, positions, facing directions, and timing.",
      "unsupported",
    ],
    [
      "Build a game or VR environment using these assets, matching their relative scales and organizing them into a coherent, navigable space.",
      "blender-plaza",
    ],
    [
      "Assemble these assets into a themed miniature world with a main subject, environment, accessories, and base, and optimize its structure for 3D printing.",
      "unsupported",
    ],
    [
      "Create multiple layout options for this space, accounting for functional needs, walkways, and visibility, and present them for comparison.",
      "unsupported",
    ],
    [
      "Unify textures, materials, and colors across these assets while preserving each asset’s distinctive features.",
      "edit",
    ],
    [
      "Create a complete demo video of this scene, coordinating lighting, camera movement, animation, and pacing.",
      "unsupported",
    ],
    [
      "Find and fill unintended holes in this model while preserving its overall shape and intentional openings.",
      "blender-repair",
    ],
    [
      "Check this model’s textures and fix missing textures, distortion, and visible seams while preserving its intended appearance.",
      "edit",
    ],
    [
      "Check and correct this character’s skinning weights to reduce unnatural deformation during movement while preserving the existing skeleton.",
      "unsupported",
    ],
    [
      "Split this model into parts and add matching connectors for assembly, allowing appropriate clearance while preserving the model’s assembled appearance.",
      "unsupported",
    ],
  ];
  for (const [prompt, kind] of rows) {
    assert.equal(classifyIntent(prompt).kind, kind, prompt.slice(0, 48));
  }
});
