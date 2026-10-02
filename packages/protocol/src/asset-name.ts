export function parseAssetName(file: string): { family: string; version: number; label: string; file: string } {
  const base = file.split("/").pop() ?? file;
  const m = base.match(/^lab-([\w-]+)_(\d+)\.glb$/i);
  if (!m) return { family: base, version: 0, label: base, file: base };
  return { family: m[1], version: Number(m[2]), label: `${m[1]} · v${m[2]}`, file: base };
}
