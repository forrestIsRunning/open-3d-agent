export {};

declare global {
  interface Window {
    lab: {
      open: () => Promise<{
        workspace: string;
        fake?: boolean;
        model?: string;
        approvalPolicy?: string;
        threadId?: string;
        messages?: Array<{ role: string; text: string }>;
        lastAsset?: string;
        sessionId?: number;
        sessions?: Array<{ id: number; title: string; threadId: string }>;
      }>;
      send: (text: string) => Promise<unknown>;
      remember: (role: string, text: string) => Promise<{ sessionId?: number; sessions?: Array<{ id: number; title: string }> }>;
      cancel: () => Promise<{ ok?: boolean }>;
      sessionList: () => Promise<{
        messages?: Array<{ role: string; text: string }>;
        lastAsset?: string;
        sessionId: number;
        sessions: Array<{ id: number; title: string; threadId: string }>;
      }>;
      sessionNew: () => Promise<{
        threadId: string;
        sessionId: number;
        sessions: Array<{ id: number; title: string; threadId: string }>;
        messages: Array<{ role: string; text: string }>;
      }>;
      sessionOpen: (id: number) => Promise<{
        threadId: string;
        sessionId: number;
        sessions: Array<{ id: number; title: string; threadId: string }>;
        messages: Array<{ role: string; text: string }>;
      }>;
      approve: (id: string, result: unknown) => Promise<unknown>;
      latestModel: () => Promise<{ name?: string }>;
      readModel: (name: string) => Promise<{ name: string; b64: string }>;
      runCube: () => Promise<{ path?: string }>;
      runLamb: () => Promise<{ path?: string }>;
      runTripo: (prompt?: string) => Promise<{ path?: string }>;
      generate: (prompt: string, name: string, imagePath?: string) => Promise<{ path?: string }>;
      importGlb: (b64: string, name?: string) => Promise<{ path?: string }>;
      edit: (prompt: string, family: string, imagePath?: string) => Promise<{ path?: string }>;
      transform: (
        source: string,
        op: string,
        extra?: { height?: number; yaw?: number },
      ) => Promise<{ path?: string }>;
      plaza: () => Promise<{ path?: string }>;
      fillHoles: (source: string) => Promise<{ path?: string }>;
      saveRef: (b64: string, ext?: string) => Promise<{ name: string; path: string }>;
      listAssets: () => Promise<{ names: string[] }>;
      saveImage: (name: string, b64: string) => Promise<{ path?: string }>;
      readImage: (name: string) => Promise<{ b64?: string }>;
      readLabImage: (rel: string) => Promise<{ b64?: string; path?: string }>;
      saveShot: (b64: string) => Promise<{ name: string; path: string }>;
      deleteAsset: (name: string) => Promise<unknown>;
      stop: () => Promise<unknown>;
      onEvent: (cb: (ev: { method: string; params: unknown }) => void) => () => void;
    };
  }
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
