<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { mountViewer, loadGlbBuffer } from "./viewer.ts";

let opened = false;

type Msg = { role: "user" | "agent" | "tool" | "system"; text: string };

const messages = ref<Msg[]>([]);
const input = ref("介绍一下自己");
const ready = ref(false);
const busy = ref(false);
const fake = ref<boolean | null>(null);
const model = ref("");
const policy = ref("");
const approval = ref<{ id: string; text: string } | null>(null);
let unsub: (() => void) | undefined;
let viewEl: HTMLDivElement | null = null;
let lastModel = "";

onMounted(async () => {
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
    policy.value = info.approvalPolicy ?? "";
    messages.value.push({
      role: "system",
      text: `workspace ${info.workspace} · policy ${policy.value || "never"}`,
    });
    await nextTick();
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
    const raw = await window.lab.readModel(name);
    const bin = atob(raw.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    await loadGlbBuffer(bytes);
    messages.value.push({ role: "system", text: `产物：${name}` });
  } catch (err) {
    lastModel = "";
    messages.value.push({ role: "system", text: `加载失败 ${name}: ${String(err)}` });
  }
}

async function cube(): Promise<void> {
  busy.value = true;
  try {
    const r = (await window.lab.runCube()) as { path?: string };
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
    const r = (await window.lab.runTripo("a cute low poly fox")) as { path?: string };
    const name = r?.path?.split("/").pop();
    if (name) await showModel(name);
  } catch (err) {
    messages.value.push({ role: "system", text: String(err) });
  } finally {
    busy.value = false;
  }
}

function bindView(el: Element | null): void {
  if (el instanceof HTMLDivElement && el !== viewEl) {
    viewEl = el;
    mountViewer(el);
  }
}
</script>

<template>
  <div class="layout">
    <section class="chat">
      <header>
        Lab 3D Agent
        <span v-if="fake === true" class="badge fake">FAKE</span>
        <span v-else-if="fake === false" class="badge live">LIVE</span>
        <span class="meta">{{ model }} {{ policy }}</span>
      </header>
      <div class="log">
        <p v-for="(m, i) in messages" :key="i" :class="m.role">{{ m.text }}</p>
      </div>
      <div v-if="approval" class="approval">
        <span>{{ approval.text }}</span>
        <button @click="decide(true)">Allow</button>
        <button @click="decide(false)">Deny</button>
      </div>
      <div class="actions">
        <button :disabled="!ready || busy" @click="cube">Blender cube</button>
        <button :disabled="!ready || busy" @click="fox">Tripo fox</button>
      </div>
      <form @submit.prevent="send">
        <input v-model="input" :disabled="!ready" />
        <button :disabled="!ready">Send</button>
      </form>
    </section>
    <section class="view" :ref="bindView"></section>
  </div>
</template>

<style>
.layout { display: grid; grid-template-columns: 380px 1fr; height: 100%; min-height: 0; }
.chat { display: flex; flex-direction: column; border-right: 1px solid #ddd; }
header { padding: 12px 16px; font-weight: 600; display: flex; gap: 8px; align-items: center; }
.badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; color: #fff; }
.badge.fake { background: #c0392b; }
.badge.live { background: #1e8449; }
.meta { font-weight: 400; font-size: 12px; color: #666; }
.log { flex: 1; overflow: auto; padding: 12px 16px; }
.log p { margin: 0 0 8px; white-space: pre-wrap; font-size: 13px; }
.user { color: #111; }
.agent { color: #063; }
.tool { color: #555; font-family: ui-monospace, monospace; }
.system { color: #36c; }
.actions, form { display: flex; gap: 8px; padding: 8px 12px; }
form input { flex: 1; }
.view { background: #1a1d23; min-width: 0; min-height: 0; overflow: hidden; position: relative; }
.approval { padding: 8px 16px; background: #fff3cd; display: flex; gap: 8px; align-items: center; }
</style>
