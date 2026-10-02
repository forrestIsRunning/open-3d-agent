export type TransformOp = "ground" | "height" | "yaw";

export type Intent =
  | { kind: "chat" }
  | { kind: "generate"; prompt: string; name: string }
  | { kind: "edit"; prompt: string }
  | { kind: "blender-transform"; op: TransformOp; height?: number; yaw?: number }
  | { kind: "blender-cube" }
  | { kind: "blender-lamb" }
  | { kind: "blender-plaza" }
  | { kind: "blender-repair" }
  | { kind: "unsupported"; reason: string };

export function classifyIntent(text: string): Intent {
  const t = text.trim();
  if (!t) return { kind: "chat" };
  const blocked = classifyUnsupported(t);
  if (blocked) return blocked;
  if (/立方体|\bcube\b/i.test(t)) return { kind: "blender-cube" };
  if (/小羊|羔羊|\blamb\b|\bsheep\b/i.test(t) && !/改|换成|变成/.test(t)) {
    return { kind: "blender-lamb" };
  }
  if (/plaza|virtual scene|navigable|game or vr|摆场景|广场/i.test(t)) {
    return { kind: "blender-plaza" };
  }
  if (/fill holes|补洞|填洞|unintended holes/i.test(t)) return { kind: "blender-repair" };
  const xf = classifyTransform(t);
  if (xf) return xf;
  if (isEdit(t)) return { kind: "edit", prompt: t };
  const wantsModel = /生成|文生|3d\s*model|3D 模型|模型|glb|\bmake\b|\bgenerate\b/i.test(t);
  if (wantsModel) return { kind: "generate", prompt: t, name: guessName(t) };
  return { kind: "chat" };
}

function classifyUnsupported(t: string): Intent | null {
  if (/animate character|coordinating their actions|facing directions, and timing|short story scene/i.test(t)) {
    return {
      kind: "unsupported",
      reason:
        "Character animation (rig + timed blocking) is not in this lab. Generate still GLBs, then animate in a DCC.",
    };
  }
  if (/printable miniature|3d printing|themed miniature world/i.test(t)) {
    return {
      kind: "unsupported",
      reason: "Printable miniature packing is not implemented. Use fill-holes / ground on a single mesh instead.",
    };
  }
  if (/layout options|multiple layout|walkways, and visibility/i.test(t)) {
    return {
      kind: "unsupported",
      reason: "Multiple layout options are not implemented. Ask for a plaza to get one scaled layout.",
    };
  }
  if (/demo video|camera movement, animation, and pacing/i.test(t)) {
    return {
      kind: "unsupported",
      reason: "Scene demo video is not implemented. Capture stills from the stage.",
    };
  }
  if (/skinning weights|existing skeleton/i.test(t)) {
    return {
      kind: "unsupported",
      reason: "Skinning-weight repair needs a rigged character. This host does not edit bone weights.",
    };
  }
  if (/split this model into parts|add matching connectors|assembly/i.test(t)) {
    return {
      kind: "unsupported",
      reason: "Split-and-connectors for print assembly is not implemented.",
    };
  }
  return null;
}

function isEdit(t: string): boolean {
  if (/^(生成|做一个|做一只|新建)/.test(t)) return false;
  return /改成|换成|变成|改一|编辑|更尖|更红|更蓝|衣服|耳朵|颜色|材质|胖一点|瘦一点|edit\b|restyle|unify (textures|styles|materials)|repair textures|fix missing textures/i.test(
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
  if (/哈士奇|husky/.test(t)) return "husky";
  if (/小狗|puppy|\bdog\b|狗/.test(t)) return "puppy";
  if (/狐狸|\bfox\b/.test(t)) return "fox";
  if (/猫|\bcat\b|kitten/.test(t)) return "cat";
  if (/羊|lamb|sheep/.test(t)) return "lamb";
  if (/女人|woman|female/.test(t)) return "woman";
  if (/男人|man|male/.test(t)) return "man";
  return "gen";
}
