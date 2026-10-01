export {};

declare global {
  interface Window {
    lab: {
      open: () => Promise<{ workspace: string }>;
      send: (text: string) => Promise<unknown>;
      approve: (id: string, result: unknown) => Promise<unknown>;
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
