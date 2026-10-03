function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compact Markdown for chat bubbles. Escapes HTML first. */
export function renderMd(src: string): string {
  const raw = src.replace(/\r\n/g, "\n").trim();
  if (!raw) return "";
  const fences: string[] = [];
  let s = escapeHtml(raw).replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, body) => {
    const i = fences.length;
    fences.push(`<pre><code>${String(body).replace(/^\n+|\n+$/g, "")}</code></pre>`);
    return `\u0000F${i}\u0000`;
  });
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/^### (.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^# (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  s = s.replace(/^(?:- |\* )(.+)$/gm, "<li>$1</li>");
  s = s.replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`);
  s = s.replace(/\n{2,}/g, "</p><p>");
  s = `<p>${s}</p>`;
  s = s.replace(/\u0000F(\d+)\u0000/g, (_m, i) => fences[Number(i)] ?? "");
  s = s.replace(/<p>\s*(<h[34]>)/g, "$1");
  s = s.replace(/(<\/h[34]>)\s*<\/p>/g, "$1");
  s = s.replace(/<p>\s*(<ul>)/g, "$1");
  s = s.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  s = s.replace(/<p>\s*(<pre>)/g, "$1");
  s = s.replace(/(<\/pre>)\s*<\/p>/g, "$1");
  s = s.replace(/<p>\s*<\/p>/g, "");
  return s.replace(/\n/g, "<br>");
}
