import { test } from "node:test";
import assert from "node:assert/strict";
import { headingSlugs, parseMarkdown } from "../src/parse.js";

test("extracts headings with levels and line numbers", () => {
  const doc = parseMarkdown("# Title\n\ntext\n\n## Section ##\n");
  assert.deepEqual(doc.headings, [
    { level: 1, text: "Title", line: 1 },
    { level: 2, text: "Section", line: 5 },
  ]);
});

test("extracts inline links and images", () => {
  const doc = parseMarkdown('[a](https://a.dev "t") and ![logo](img/l.png)');
  assert.deepEqual(
    doc.links.map((l) => [l.kind, l.url, l.text]),
    [
      ["link", "https://a.dev", "a"],
      ["image", "img/l.png", "logo"],
    ],
  );
});

test("ignores fenced, indented and inline code", () => {
  const md = "```\n# not heading\n[x](y.md)\n```\n\n    [z](w.md)\n\nuse `[q](r.md)` here\n";
  const doc = parseMarkdown(md);
  assert.equal(doc.headings.length, 0);
  assert.equal(doc.links.length, 0);
});

test("resolves reference links and reports undefined ones", () => {
  const doc = parseMarkdown("[docs][d] and [Site][] and [x][missing]\n\n[d]: ./docs.md\n[site]: https://s.dev\n");
  assert.deepEqual(doc.links.map((l) => l.url), ["./docs.md", "https://s.dev"]);
  assert.deepEqual(doc.undefinedRefs, [{ label: "missing", line: 1 }]);
});

test("reads HTML href, src and every srcset candidate", () => {
  const doc = parseMarkdown('<a href="https://x.dev"><img src="a.png"></a>\n<source srcset="b.svg 1x, c.svg 2x">');
  assert.deepEqual(doc.links.map((l) => [l.kind, l.source, l.url]), [
    ["link", "html", "https://x.dev"],
    ["image", "html", "a.png"],
    ["image", "html", "b.svg"],
    ["image", "html", "c.svg"],
  ]);
});

test("collects autolinks", () => {
  assert.deepEqual(parseMarkdown("see <https://auto.dev>").links.map((l) => l.url), ["https://auto.dev"]);
});

test("keeps inline code in heading text", () => {
  assert.equal(parseMarkdown("## Run `npm test`").headings[0]!.text, "Run `npm test`");
});

test("builds GitHub-style slugs with duplicate suffixes", () => {
  const doc = parseMarkdown("# Usage\n## Usage\n## The `inspectFile()` API\n## FAQ & Help\n## Привет, мир!\n");
  assert.deepEqual(headingSlugs(doc.headings), ["usage", "usage-1", "the-inspectfile-api", "faq--help", "привет-мир"]);
});
