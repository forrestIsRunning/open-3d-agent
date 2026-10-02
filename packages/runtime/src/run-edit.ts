import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseAssetName } from "@lab3d/protocol";
import { commitModel } from "./commit-model.ts";
import { findGlb, findImage, spawnTripo } from "./run-tripo.ts";

export function latestFamilyGlb(workspace: string, family: string): string | null {
  const files = readdirSync(workspace)
    .filter((n) => new RegExp(`^lab-${family}_\\d+\\.glb$`, "i").test(n))
    .sort((a, b) => parseAssetName(a).version - parseAssetName(b).version);
  return files.length ? join(workspace, files[files.length - 1]) : null;
}

function newestInDir(dir: string, test: (n: string) => boolean): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter(test)
    .map((n) => join(dir, n))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  return files.at(-1) ?? null;
}

export function resolveEditImage(workspace: string, family: string, imagePath?: string): string {
  if (imagePath) {
    if (!existsSync(imagePath)) throw new Error(`edit image missing: ${imagePath}`);
    return imagePath;
  }
  const thumb = newestInDir(join(workspace, ".lab/thumbs"), (n) =>
    new RegExp(`^lab-${family}_\\d+\\.png$`, "i").test(n),
  );
  if (thumb) return thumb;
  const shot = newestInDir(join(workspace, ".lab/shots"), (n) => /\.png$/i.test(n));
  if (shot) return shot;
  const ref = newestInDir(join(workspace, ".lab/refs"), (n) => /\.(png|jpe?g|webp)$/i.test(n));
  if (ref) return ref;
  throw new Error("capture the viewport or drop a reference image before editing");
}

function saveConcept(
  workspace: string,
  family: string,
  srcImage: string,
  onConcept?: (rel: string) => void,
): string {
  const dir = join(workspace, ".lab/concepts");
  mkdirSync(dir, { recursive: true });
  const rel = `.lab/concepts/${family}.png`;
  copyFileSync(srcImage, join(workspace, rel));
  onConcept?.(rel);
  return rel;
}

export function runEdit3d(
  workspace: string,
  opts: {
    prompt: string;
    family: string;
    imagePath?: string;
    onConcept?: (rel: string) => void;
  },
): string {
  const family = opts.family.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  if (!family) throw new Error("edit needs current family");
  const src = latestFamilyGlb(workspace, family);
  if (!src) throw new Error(`no lab-${family}_N.glb on stage`);
  const image = resolveEditImage(workspace, family, opts.imagePath);
  if (process.env.LAB_TRIPO_STUB === "1") {
    mkdirSync(join(workspace, ".lab/thumbs"), { recursive: true });
    saveConcept(workspace, family, image, opts.onConcept);
    return commitModel(workspace, family, src);
  }
  const stamp = Date.now();
  const imgDir = join(workspace, "exports", `lab-edit-img-${family}-${stamp}`);
  const glbDir = join(workspace, "exports", `lab-edit-glb-${family}-${stamp}`);
  mkdirSync(imgDir, { recursive: true });
  mkdirSync(glbDir, { recursive: true });
  spawnTripo(
    workspace,
    ["generate", "image-to-image", image, "--prompt", opts.prompt],
    imgDir,
  );
  const edited = findImage(imgDir);
  if (!edited) throw new Error("tripo image-to-image wrote no image");
  saveConcept(workspace, family, edited, opts.onConcept);
  spawnTripo(
    workspace,
    ["generate", "image-to-model", edited, "--prompt", opts.prompt],
    glbDir,
  );
  const glb = findGlb(glbDir);
  if (!glb) throw new Error("tripo image-to-model wrote no glb");
  const dest = commitModel(workspace, family, glb);
  const thumbDir = join(workspace, ".lab/thumbs");
  mkdirSync(thumbDir, { recursive: true });
  const base = dest.split("/").pop()!.replace(/\.glb$/i, ".png");
  copyFileSync(edited, join(thumbDir, base));
  copyFileSync(edited, join(thumbDir, `lab-edit-${family}-${stamp}.png`));
  return dest;
}
