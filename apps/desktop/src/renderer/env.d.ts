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
      }>;
      send: (text: string) => Promise<unknown>;
      approve: (id: string, result: unknown) => Promise<unknown>;
      latestModel: () => Promise<{ name?: string }>;
      readModel: (name: string) => Promise<{ name: string; b64: string }>;
      runCube: () => Promise<{ path?: string }>;
      runTripo: (prompt?: string) => Promise<{ path?: string }>;
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
