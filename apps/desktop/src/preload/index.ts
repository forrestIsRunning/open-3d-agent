import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lab", {
  open: () => ipcRenderer.invoke("lab:open"),
  send: (text: string) => ipcRenderer.invoke("lab:send", text),
  approve: (id: string, result: unknown) => ipcRenderer.invoke("lab:approve", { id, result }),
  latestModel: () => ipcRenderer.invoke("lab:latestModel"),
  runCube: () => ipcRenderer.invoke("lab:runCube"),
  runTripo: (prompt?: string) => ipcRenderer.invoke("lab:runTripo", prompt),
  stop: () => ipcRenderer.invoke("lab:stop"),
  onEvent: (cb: (ev: { method: string; params: unknown }) => void) => {
    const fn = (_: unknown, ev: { method: string; params: unknown }) => cb(ev);
    ipcRenderer.on("runtime-event", fn);
    return () => ipcRenderer.removeListener("runtime-event", fn);
  },
});
