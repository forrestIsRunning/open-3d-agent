import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lab", {
  open: () => ipcRenderer.invoke("lab:open"),
  send: (text: string) => ipcRenderer.invoke("lab:send", text),
  approve: (id: string, result: unknown) => ipcRenderer.invoke("lab:approve", { id, result }),
  latestModel: () => ipcRenderer.invoke("lab:latestModel"),
  readModel: (name: string) => ipcRenderer.invoke("lab:readModel", name),
  runCube: () => ipcRenderer.invoke("lab:runCube"),
  runLamb: () => ipcRenderer.invoke("lab:runLamb"),
  runTripo: (prompt?: string) => ipcRenderer.invoke("lab:runTripo", prompt),
  generate: (prompt: string, name: string, imagePath?: string) =>
    ipcRenderer.invoke("lab:generate", { prompt, name, imagePath }),
  importGlb: (b64: string, name?: string) => ipcRenderer.invoke("lab:importGlb", b64, name),
  edit: (prompt: string, family: string, imagePath?: string) =>
    ipcRenderer.invoke("lab:edit", { prompt, family, imagePath }),
  transform: (source: string, op: string, extra?: { height?: number; yaw?: number }) =>
    ipcRenderer.invoke("lab:transform", { source, op, ...extra }),
  plaza: () => ipcRenderer.invoke("lab:plaza"),
  fillHoles: (source: string) => ipcRenderer.invoke("lab:fillHoles", source),
  saveRef: (b64: string, ext?: string) => ipcRenderer.invoke("lab:saveRef", b64, ext),
  listAssets: () => ipcRenderer.invoke("lab:listAssets"),
  saveImage: (name: string, b64: string) => ipcRenderer.invoke("lab:saveImage", name, b64),
  readImage: (name: string) => ipcRenderer.invoke("lab:readImage", name),
  readLabImage: (rel: string) => ipcRenderer.invoke("lab:readLabImage", rel),
  saveShot: (b64: string) => ipcRenderer.invoke("lab:saveShot", b64),
  deleteAsset: (name: string) => ipcRenderer.invoke("lab:deleteAsset", name),
  stop: () => ipcRenderer.invoke("lab:stop"),
  onEvent: (cb: (ev: { method: string; params: unknown }) => void) => {
    const fn = (_: unknown, ev: { method: string; params: unknown }) => cb(ev);
    ipcRenderer.on("runtime-event", fn);
    return () => ipcRenderer.removeListener("runtime-event", fn);
  },
});
