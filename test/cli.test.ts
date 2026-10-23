import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = (...args: string[]) => spawnSync(process.execPath, ["dist/src/cli.js", ...args], { encoding: "utf8" });

test("exits 0 and prints a summary for a clean file", () => {
  const r = run("test/fixtures/good.md", "--no-color");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no problems found/);
});

test("exits 1 when errors are found", () => {
  const r = run("test/fixtures/bad.md", "--no-color");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /missing-image/);
});

test("exits 2 for a missing file or unknown option", () => {
  assert.equal(run("nope.md").status, 2);
  assert.equal(run("test/fixtures/good.md", "--bogus").status, 2);
});

test("rejects an invalid --timeout", () => {
  assert.equal(run("test/fixtures/good.md", "--check-remote", "--timeout", "abc").status, 2);
});

test("--format json prints parseable JSON and keeps the exit code", () => {
  const r = run("test/fixtures/bad.md", "--format", "json");
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).summary.errors, 4);
});

test("rejects an unknown --format", () => {
  assert.equal(run("test/fixtures/good.md", "--format", "xml").status, 2);
});
