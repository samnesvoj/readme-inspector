import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { checkRemote } from "../src/remote.js";
import { parseMarkdown } from "../src/parse.js";

test("reports 404s as errors, server errors and timeouts as warnings", async (t) => {
  let hits = 0;
  const server = createServer((req, res) => {
    hits++;
    if (req.url === "/ok") return res.end("ok");
    if (req.url === "/head-not-allowed") return res.writeHead(req.method === "HEAD" ? 405 : 200).end();
    if (req.url === "/gone") return res.writeHead(404).end();
    if (req.url === "/boom") return res.writeHead(500).end();
    if (req.url === "/slow") return void setTimeout(() => res.end(), 2_000);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const md = [
    `[a](${base}/ok) [same](${base}/ok#section)`,
    `![b](${base}/head-not-allowed)`,
    `[c](${base}/gone)`,
    `[d](${base}/boom)`,
    `[e](${base}/slow)`,
    `[local](docs/x.md)`,
  ].join("\n");
  const issues = await checkRemote(parseMarkdown(md), { timeoutMs: 300 });

  assert.deepEqual(issues.map((i) => `${i.line}:${i.severity}:${i.rule}`).sort(), [
    "3:error:broken-remote-link",
    "4:warning:unreachable-link",
    "5:warning:unreachable-link",
  ]);
  assert.match(issues.find((i) => i.line === 5)!.message, /timed out after 300 ms/);
  // /ok is requested once even though it appears twice (fragment ignored)
  assert.ok(hits <= 8, `expected de-duplicated requests, got ${hits}`);
});

test("returns no issues and makes no requests when there are no remote links", async () => {
  let called = false;
  const fetchImpl = (async () => { called = true; return new Response(); }) as typeof fetch;
  assert.deepEqual(await checkRemote(parseMarkdown("[x](local.md)"), { fetchImpl }), []);
  assert.equal(called, false);
});
