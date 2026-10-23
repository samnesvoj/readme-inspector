import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectRepo, parseRepoSpec } from "../src/github.js";

test("parses repository specs", () => {
  assert.deepEqual(parseRepoSpec("github:octo/hello.js"), { owner: "octo", repo: "hello.js" });
  assert.deepEqual(parseRepoSpec("https://github.com/octo/hello.git"), { owner: "octo", repo: "hello" });
  assert.equal(parseRepoSpec("README.md"), null);
  assert.equal(parseRepoSpec("github:only-owner"), null);
});

function fakeGitHub(readme: string, readmePath: string, paths: string[], seen: string[] = []) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    seen.push(`${url} ${new Headers(init?.headers).get("authorization") ?? ""}`.trim());
    if (url.endsWith("/readme")) {
      return Response.json({ path: readmePath, encoding: "base64", content: Buffer.from(readme).toString("base64") });
    }
    if (url.includes("/git/trees/HEAD")) {
      return Response.json({ truncated: false, tree: paths.map((path) => ({ path })) });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

test("checks relative links against the repository tree", async () => {
  const md = "# Repo\n\n![logo](docs/logo.png) [guide](./docs/) [api](../src/index.ts) [nope](missing.md) [abs](/LICENSE)\n";
  const seen: string[] = [];
  const report = await inspectRepo(
    { owner: "o", repo: "r" },
    { token: "t0k", fetchImpl: fakeGitHub(md, "README.md", ["README.md", "docs", "docs/logo.png", "LICENSE"], seen) },
  );
  assert.equal(report.file, "github:o/r/README.md");
  assert.deepEqual(report.issues.map((i) => `${i.line}:${i.rule}`), ["3:broken-local-link", "3:broken-local-link"]);
  assert.match(report.issues.map((i) => i.message).join(), /\.\.\/src\/index\.ts.*missing\.md/);
  assert.ok(seen.every((s) => s.endsWith("Bearer t0k")), "token is sent to every request");
});

test("explains API failures", async () => {
  const fetchImpl = (async () => new Response("", { status: 404 })) as typeof fetch;
  await assert.rejects(inspectRepo({ owner: "o", repo: "missing" }, { fetchImpl }), /404.*not found/);
});
