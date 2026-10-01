<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { mountViewer, loadGlbBuffer } from "./viewer.ts";

type Msg = { role: "user" | "agent" | "tool" | "system"; text: string };

const messages = ref<Msg[]>([]);
const input = ref("介绍一下自己");
const ready = ref(false);
const busy = ref(false);
const fake = ref<boolean | null>(null);
const model = ref("");
const policy = ref("");
const workspace = ref("");
const assetName = ref("");
const approval = ref<{ id: string; text: string } | null>(null);
const viewRef = ref<HTMLElement | null>(null);
let unsub: (() => void) | undefined;
let lastModel = "";
let opened = false;

watch(
  viewRef,
  (el) => {
    if (el) mountViewer(el);
  },
  { flush: "post" },
);

onMounted(async () => {
  await nextTick();
  const el = viewRef.value ?? document.querySelector<HTMLElement>(".stage");
  if (el) {
    viewRef.value = el;
    mountViewer(el);
  }
  unsub = window.lab.onEvent((ev) => {
    if (ev.method === "agent.text") {
      messages.value.push({ role: "agent", text: String((ev.params as { text: string }).text) });
    }
    if (ev.method === "agent.tool") {
      messages.value.push({ role: "tool", text: JSON.stringify(ev.params) });
    }
    if (ev.method === "turn.error") {
      messages.value.push({ role: "system", text: String((ev.params as { message: string }).message) });
    }
    if (ev.method === "approval.needed") {
      const p = ev.params as { id: string; method: string; params?: { command?: string } };
      approval.value = { id: String(p.id), text: p.params?.command || p.method };
    }
    if (ev.method === "model.ready") {
      const path = String((ev.params as { path: string }).path);
      const name = path.split("/").pop() ?? "";
      void showModel(name);
    }
  });
  if (!opened) {
    opened = true;
    const info = await window.lab.open();
    fake.value = Boolean(info.fake);
    model.value = info.model ?? "";
    policy.value = info.approvalPolicy ?? "never";
    workspace.value = info.workspace;
    messages.value.push({
      role: "system",
      text: `已连接 ${info.workspace}`,
    });
    const latest = await window.lab.latestModel();
    if (latest.name) await showModel(latest.name);
  }
  ready.value = true;
});

onUnmounted(() => unsub?.());

async function send(): Promise<void> {
  const text = input.value.trim();
  if (!text) return;
  messages.value.push({ role: "user", text });
  input.value = "";
  const cubeTalk = /立方体|cube/i.test(text);
  const foxTalk = /狐狸|fox|生成.*3d|文生3d/i.test(text);
  const pending = [window.lab.send(text)];
  if (cubeTalk) pending.push(cube());
  else if (foxTalk) pending.push(fox());
  await Promise.all(pending);
}

async function decide(allow: boolean): Promise<void> {
  if (!approval.value) return;
  await window.lab.approve(approval.value.id, { decision: allow ? "accept" : "decline" });
  approval.value = null;
}

async function showModel(name: string): Promise<void> {
  if (!name || name === lastModel) return;
  lastModel = name;
  try {
    const el = viewRef.value ?? document.querySelector<HTMLElement>(".stage");
    if (el) mountViewer(el);
    const raw = await window.lab.readModel(name);
    const bin = atob(raw.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    await loadGlbBuffer(bytes);
    assetName.value = name;
    messages.value.push({ role: "system", text: `已载入 ${name}` });
  } catch (err) {
    lastModel = "";
    messages.value.push({ role: "system", text: `加载失败 ${name}: ${String(err)}` });
  }
}

async function cube(): Promise<void> {
  busy.value = true;
  try {
    const r = await window.lab.runCube();
    const name = r?.path?.split("/").pop();
    if (name) await showModel(name);
  } catch (err) {
    messages.value.push({ role: "system", text: String(err) });
  } finally {
    busy.value = false;
  }
}

async function fox(): Promise<void> {
  busy.value = true;
  try {
    const r = await window.lab.runTripo("a cute low poly fox");
    const name = r?.path?.split("/").pop();
    if (name) await showModel(name);
  } catch (err) {
    messages.value.push({ role: "system", text: String(err) });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="shell">
    <aside class="rail">
      <header class="brand">
        <div class="mark">3D</div>
        <div>
          <div class="title">Lab 3D Agent</div>
          <div class="sub">Codex · Blender · Tripo</div>
        </div>
        <span v-if="fake === true" class="badge fake">FAKE</span>
        <span v-else-if="fake === false" class="badge live">LIVE</span>
      </header>

      <div class="chips">
        <span class="chip" v-if="model">{{ model }}</span>
        <span class="chip">{{ policy || "never" }}</span>
      </div>

      <div class="log">
        <article v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
          <span class="who">{{ m.role }}</span>
          <p>{{ m.text }}</p>
        </article>
      </div>

      <div v-if="approval" class="approval">
        <div class="ap-label">需要审批</div>
        <code>{{ approval.text }}</code>
        <div class="ap-btns">
          <button class="ok" @click="decide(true)">Allow</button>
          <button class="no" @click="decide(false)">Deny</button>
        </div>
      </div>

      <div class="dock">
        <div class="actions">
          <button class="primary" :disabled="!ready || busy" @click="cube">Blender 立方体</button>
          <button :disabled="!ready || busy" @click="fox">Tripo 狐狸</button>
        </div>
        <form @submit.prevent="send">
          <input v-model="input" :disabled="!ready" placeholder="给模型发一句…" />
          <button class="send" :disabled="!ready">发送</button>
        </form>
      </div>
    </aside>

    <main class="stage-wrap">
      <div class="stage" ref="viewRef"></div>
      <div class="hud">
        <span>{{ assetName || "视窗" }}</span>
        <span v-if="busy">导出中…</span>
        <span class="path" :title="workspace">{{ workspace }}</span>
      </div>
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
  --bg: #101218;
  --rail: #161a22;
  --line: #2a3140;
  --text: #e8ecf3;
  --muted: #8b95a7;
  --live: #3dd68c;
  --fake: #ff6b6b;
  --accent: #f4a261;
  --agent: #7ee0c8;
}
* { box-sizing: border-box; }
.shell {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--rail);
  border-right: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 8px;
}
.mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(145deg, #f4a261, #e76f51);
  color: #1a120c;
  font-weight: 700;
  display: grid;
  place-items: center;
  letter-spacing: -0.04em;
}
.title { font-weight: 650; font-size: 14px; }
.sub { color: var(--muted); font-size: 11px; }
.badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 3px 7px;
  border-radius: 999px;
}
.badge.live { background: #143528; color: var(--live); }
.badge.fake { background: #3a1518; color: var(--fake); }
.chips { display: flex; gap: 6px; padding: 0 16px 10px; flex-wrap: wrap; }
.chip {
  font-size: 11px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 8px;
}
.log {
  flex: 1;
  overflow: auto;
  padding: 8px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg {
  border-radius: 10px;
  padding: 8px 10px;
  background: #1d2330;
}
.msg .who {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 4px;
}
.msg p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.msg.user { background: #243044; }
.msg.agent { background: #17312c; }
.msg.agent .who { color: var(--agent); }
.msg.system { background: transparent; border: 1px dashed var(--line); color: #9db4ff; }
.msg.tool { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.approval {
  margin: 0 12px 8px;
  padding: 10px;
  border-radius: 10px;
  background: #3a2a12;
  border: 1px solid #7a5420;
}
.ap-label { font-size: 11px; color: var(--accent); margin-bottom: 6px; }
.approval code { display: block; font-size: 11px; color: #f3d9b0; word-break: break-all; }
.ap-btns { display: flex; gap: 8px; margin-top: 8px; }
.ok { background: #2f6f4e; color: #fff; }
.no { background: #7a2e2e; color: #fff; }
.dock { padding: 12px; border-top: 1px solid var(--line); }
.actions, form { display: flex; gap: 8px; }
.actions { margin-bottom: 8px; }
button {
  appearance: none;
  border: 1px solid var(--line);
  background: #222836;
  color: var(--text);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}
button:disabled { opacity: 0.45; cursor: default; }
button.primary { background: #c56a2d; border-color: #d07a3c; color: #fff; }
button.send { background: #2b3344; }
form { flex: 1; }
form input {
  flex: 1;
  border: 1px solid var(--line);
  background: #10141c;
  color: var(--text);
  border-radius: 8px;
  padding: 8px 10px;
  outline: none;
}
form input:focus { border-color: #5b6b88; }
.stage-wrap { position: relative; min-width: 0; min-height: 0; }
.stage { position: absolute; inset: 0; background: #0e1116; }
.hud {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  pointer-events: none;
  font-size: 11px;
  color: #c5cddd;
  background: rgba(12, 14, 18, 0.55);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 6px 10px;
  backdrop-filter: blur(8px);
}
.hud .path { margin-left: auto; opacity: 0.7; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
