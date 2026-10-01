<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { mountViewer, loadGlb } from "./viewer.ts";

let opened = false;

type Msg = { role: "user" | "agent" | "tool" | "system"; text: string };

const messages = ref<Msg[]>([]);
const input = ref("列出这个目录里的文件");
const ready = ref(false);
const approval = ref<{ id: string; text: string } | null>(null);
let unsub: (() => void) | undefined;
let viewEl: HTMLDivElement | null = null;

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
      const p = ev.params as { id: string; method: string };
      approval.value = { id: String(p.id), text: p.method };
    }
    if (ev.method === "model.ready") {
      const path = String((ev.params as { path: string }).path);
      const name = path.split("/").pop() ?? "";
      loadGlb(`lab-asset://workspace/${name}`);
      messages.value.push({ role: "system", text: `产物：${name}` });
    }
  });
  if (!opened) {
    opened = true;
    const info = await window.lab.open();
    messages.value.push({ role: "system", text: `workspace ${info.workspace}` });
  }
  ready.value = true;
});

onUnmounted(() => unsub?.());

async function send(): Promise<void> {
  const text = input.value.trim();
  if (!text) return;
  messages.value.push({ role: "user", text });
  input.value = "";
  await window.lab.send(text);
}

async function decide(allow: boolean): Promise<void> {
  if (!approval.value) return;
  await window.lab.approve(approval.value.id, { decision: allow ? "accept" : "decline" });
  approval.value = null;
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
      <header>Lab 3D Agent</header>
      <div class="log">
        <p v-for="(m, i) in messages" :key="i" :class="m.role">{{ m.text }}</p>
      </div>
      <div v-if="approval" class="approval">
        <span>{{ approval.text }}</span>
        <button @click="decide(true)">Allow</button>
        <button @click="decide(false)">Deny</button>
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
header { padding: 12px 16px; font-weight: 600; }
.log { flex: 1; overflow: auto; padding: 12px 16px; }
.log p { margin: 0 0 8px; white-space: pre-wrap; font-size: 13px; }
.user { color: #111; }
.agent { color: #063; }
.tool { color: #555; font-family: ui-monospace, monospace; }
.system { color: #36c; }
form { display: flex; gap: 8px; padding: 12px; }
form input { flex: 1; }
.view { background: #1a1d23; min-width: 0; min-height: 0; overflow: hidden; position: relative; }
.approval { padding: 8px 16px; background: #fff3cd; display: flex; gap: 8px; align-items: center; }
</style>
