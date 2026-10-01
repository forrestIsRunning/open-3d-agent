import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lab", {
  open: () => ipcRenderer.invoke("lab:open"),
  send: (text: string) => ipcRenderer.invoke("lab:send", text),
  approve: (id: string, result: unknown) => ipcRenderer.invoke("lab:approve", { id, result }),
  stop: () => ipcRenderer.invoke("lab:stop"),
  onEvent: (cb: (ev: { method: string; params: unknown }) => void) => {
    const fn = (_: unknown, ev: { method: string; params: unknown }) => cb(ev);
    ipcRenderer.on("runtime-event", fn);
    return () => ipcRenderer.removeListener("runtime-event", fn);
  },
});
