import assert from "node:assert/strict";
import test from "node:test";
import { renderMd } from "./md.ts";

test("bold and inline code", () => {
  const html = renderMd("Current family is husky at **v2** — `lab-husky_2.glb`.");
  assert.match(html, /<strong>v2<\/strong>/);
  assert.match(html, /<code>lab-husky_2\.glb<\/code>/);
  assert.doesNotMatch(html, /&lt;script/);
});

test("escapes html then formats", () => {
  const html = renderMd('<img src=x onerror=alert(1)> **ok**');
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong>ok<\/strong>/);
});

test("bullets", () => {
  const html = renderMd("- silhouette\n- materials");
  assert.match(html, /<ul>/);
  assert.match(html, /<li>silhouette<\/li>/);
});
