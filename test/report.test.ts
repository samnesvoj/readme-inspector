import { test } from "node:test";
import assert from "node:assert/strict";
import { formatJson, formatMarkdown, inspectFile } from "../src/index.js";

test("JSON output has stats, a summary and sorted issues", () => {
  const out = JSON.parse(formatJson(inspectFile("test/fixtures/bad.md")));
  assert.deepEqual(out.summary, { errors: 4, warnings: 4 });
  assert.equal(out.issues.length, 8);
  assert.deepEqual(out.issues.map((i: { line: number }) => i.line), [...out.issues.map((i: { line: number }) => i.line)].sort((a, b) => a - b));
});

test("Markdown output is a table and escapes pipes", () => {
  const md = formatMarkdown({ file: "R.md", stats: { headings: 0, links: 0, images: 0 },
    issues: [{ severity: "error", rule: "x", message: "a | b", line: 3 }] });
  assert.match(md, /\| Line \| Severity \| Rule \| Message \|/);
  assert.match(md, /\| 3 \| ❌ error \| `x` \| a \\\| b \|/);
});

test("Markdown output for a clean file", () => {
  assert.match(formatMarkdown(inspectFile("test/fixtures/good.md")), /No problems found/);
});
