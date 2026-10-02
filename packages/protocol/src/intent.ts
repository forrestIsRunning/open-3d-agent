export type TransformOp = "ground" | "height" | "yaw";

export type Intent =
  | { kind: "chat" }
  | { kind: "generate"; prompt: string; name: string }
  | { kind: "edit"; prompt: string }
  | { kind: "blender-transform"; op: TransformOp; height?: number; yaw?: number }
  | { kind: "blender-cube" }
  | { kind: "blender-lamb" };

export function classifyIntent(text: string): Intent {
  const t = text.trim();
  if (!t) return { kind: "chat" };
  if (/立方体|\bcube\b/i.test(t)) return { kind: "blender-cube" };
  if (/小羊|羔羊|\blamb\b|\bsheep\b/i.test(t) && !/改|换成|变成/.test(t)) {
    return { kind: "blender-lamb" };
  }
  const xf = classifyTransform(t);
  if (xf) return xf;
  if (isEdit(t)) return { kind: "edit", prompt: t };
  const wantsModel = /生成|文生|3d\s*model|3D 模型|模型|glb|\bmake\b|\bgenerate\b/i.test(t);
  if (wantsModel) return { kind: "generate", prompt: t, name: guessName(t) };
  return { kind: "chat" };
}

function isEdit(t: string): boolean {
  if (/^(生成|做一个|做一只|新建)/.test(t)) return false;
  return /改成|换成|变成|改一|编辑|更尖|更红|更蓝|衣服|耳朵|颜色|材质|胖一点|瘦一点|edit\b|restyle/i.test(
    t,
  );
}

function classifyTransform(t: string): Intent | null {
  if (/对齐地面|贴地|落地|\bground\b/.test(t)) return { kind: "blender-transform", op: "ground" };
  const hm = t.match(/身高\s*([\d.]+)\s*米?/) || t.match(/([\d.]+)\s*m(?:eter)?s?\s*(?:tall|高)/i);
  if (hm) return { kind: "blender-transform", op: "height", height: Number(hm[1]) };
  if (/放大|缩小|统一身高|缩放到/.test(t)) {
    const n = t.match(/([\d.]+)/);
    return { kind: "blender-transform", op: "height", height: n ? Number(n[1]) : 1.7 };
  }
  const ym = t.match(/旋转\s*(-?[\d.]+)/) || t.match(/yaw\s*(-?[\d.]+)/i);
  if (ym) return { kind: "blender-transform", op: "yaw", yaw: Number(ym[1]) };
  if (/转一?下|转个向/.test(t)) return { kind: "blender-transform", op: "yaw", yaw: 90 };
  return null;
}

export function guessName(text: string): string {
  const t = text.toLowerCase();
  if (/小狗|puppy|\bdog\b|狗/.test(t)) return "puppy";
  if (/狐狸|\bfox\b/.test(t)) return "fox";
  if (/猫|\bcat\b|kitten/.test(t)) return "cat";
  if (/羊|lamb|sheep/.test(t)) return "lamb";
  if (/女人|woman|female/.test(t)) return "woman";
  if (/男人|man|male/.test(t)) return "man";
  return "gen";
}
