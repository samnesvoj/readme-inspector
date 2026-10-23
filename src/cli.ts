#!/usr/bin/env node
import { existsSync } from "node:fs";
import { exitCode, inspectFile, inspectFileWithRemote, inspectRepo, parseRepoSpec, render, type Format } from "./index.js";

const HELP = `Usage: readme-inspector [file] [options]

Audits a README for broken links, missing images and Markdown structure.

Arguments:
  file            Markdown file to inspect (default: README.md), or a GitHub
                  repository as github:owner/repo or https://github.com/owner/repo
                  (uses GITHUB_TOKEN when set)

Options:
  --check-remote  also request every http(s) link and image
  --timeout <ms>  per-request timeout for --check-remote (default: 10000)
  --format <f>    output format: text (default), json or markdown
  --strict        exit with code 1 on warnings too
  --no-color      disable ANSI colours
  -h, --help      show this help
  -v, --version   print the version`;

export async function main(argv: string[]): Promise<number> {
  argv = [...argv];
  let timeoutMs = 10_000;
  const t = argv.indexOf("--timeout");
  if (t >= 0) {
    timeoutMs = Number(argv[t + 1]);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      console.error("--timeout expects a positive number of milliseconds");
      return 2;
    }
    argv.splice(t, 2);
  }
  let format: Format = "text";
  const fi = argv.indexOf("--format");
  if (fi >= 0) {
    const value = argv[fi + 1];
    if (value !== "text" && value !== "json" && value !== "markdown") {
      console.error("--format expects one of: text, json, markdown");
      return 2;
    }
    format = value;
    argv.splice(fi, 2);
  }
  const args = argv.filter((a) => !a.startsWith("-"));
  const flags = new Set(argv.filter((a) => a.startsWith("-")));
  if (flags.has("-h") || flags.has("--help")) {
    console.log(HELP);
    return 0;
  }
  if (flags.has("-v") || flags.has("--version")) {
    console.log("0.2.0");
    return 0;
  }
  const known = new Set(["--strict", "--no-color", "--check-remote"]);
  for (const f of flags) {
    if (!known.has(f)) {
      console.error(`unknown option: ${f}\n\n${HELP}`);
      return 2;
    }
  }
  const file = args[0] ?? "README.md";
  const repo = parseRepoSpec(file);
  if (repo) {
    try {
      const report = await inspectRepo(repo, { token: process.env.GITHUB_TOKEN });
      console.log(render(report, format, !flags.has("--no-color") && process.stdout.isTTY));
      return exitCode(report, flags.has("--strict"));
    } catch (e) {
      console.error(`readme-inspector: ${(e as Error).message}`);
      return 2;
    }
  }
  if (!existsSync(file)) {
    console.error(`readme-inspector: file not found: ${file}`);
    return 2;
  }
  const report = flags.has("--check-remote") ? await inspectFileWithRemote(file, { timeoutMs }) : inspectFile(file);
  console.log(render(report, format, !flags.has("--no-color") && process.stdout.isTTY));
  return exitCode(report, flags.has("--strict"));
}

process.exitCode = await main(process.argv.slice(2));
