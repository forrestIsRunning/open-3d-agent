export type Intent =
  | { kind: "chat" }
  | { kind: "generate"; prompt: string; name: string }
  | { kind: "blender-cube" }
  | { kind: "blender-lamb" };

export function classifyIntent(text: string): Intent {
  const t = text.trim();
  if (!t) return { kind: "chat" };
  if (/立方体|\bcube\b/i.test(t)) return { kind: "blender-cube" };
  if (/小羊|羔羊|\blamb\b|\bsheep\b/i.test(t)) return { kind: "blender-lamb" };
  const wantsModel = /生成|文生|3d\s*model|3D 模型|模型|glb|\bmake\b|\bgenerate\b/i.test(t);
  if (wantsModel) return { kind: "generate", prompt: t, name: guessName(t) };
  return { kind: "chat" };
}

export function guessName(text: string): string {
  const t = text.toLowerCase();
  if (/小狗|puppy|\bdog\b|狗/.test(t)) return "puppy";
  if (/狐狸|\bfox\b/.test(t)) return "fox";
  if (/猫|\bcat\b|kitten/.test(t)) return "cat";
  return "gen";
}
