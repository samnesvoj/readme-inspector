import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectFile } from "../src/index.js";

const rules = (file: string) => inspectFile(`test/fixtures/${file}`).issues.map((i) => `${i.line}:${i.rule}`).sort();

test("a well-formed README has no issues", () => {
  assert.deepEqual(rules("good.md"), []);
});

test("reports structure and file problems with line numbers", () => {
  assert.deepEqual(rules("bad.md"), [
    "1:missing-title",
    "3:heading-skip",
    "5:image-alt",
    "5:missing-image",
    "6:broken-local-link",
    "7:empty-link-text",
    "8:undefined-reference",
    "9:missing-image",
  ].sort());
});

test("counts headings, links and images", () => {
  assert.deepEqual(inspectFile("test/fixtures/good.md").stats, { headings: 2, links: 2, images: 1 });
});

test("handles literal and encoded percent signs in local links", () => {
  assert.deepEqual(rules("percent.md"), ["3:broken-local-link"]);
});

test("validates in-page anchors against headings and HTML anchors", () => {
  assert.deepEqual(rules("anchors.md"), ["4:broken-anchor"]);
});
