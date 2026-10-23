import { readFileSync } from "node:fs";
import { checkAnchors, checkLocalFiles, checkStructure } from "./checks.js";
import { parseMarkdown } from "./parse.js";
import type { Report } from "./report.js";
import { checkRemote, type RemoteOptions } from "./remote.js";

export { headingSlugs, parseMarkdown } from "./parse.js";
export { checkAnchors, checkLocalFiles, checkRelativeTargets, checkStructure } from "./checks.js";
export type { Issue, Severity } from "./checks.js";
export { exitCode, formatJson, formatMarkdown, formatText, render } from "./report.js";
export type { Format, Report } from "./report.js";
export { checkRemote } from "./remote.js";
export { inspectRepo, parseRepoSpec } from "./github.js";
export type { GitHubOptions, RepoRef } from "./github.js";
export type { RemoteOptions } from "./remote.js";

/** Run every offline check against a README file. */
export function inspectFile(path: string): Report {
  const doc = parseMarkdown(readFileSync(path, "utf8"));
  return {
    file: path,
    issues: [...checkStructure(doc), ...checkLocalFiles(doc, path), ...checkAnchors(doc)],
    stats: {
      headings: doc.headings.length,
      links: doc.links.filter((l) => l.kind === "link").length,
      images: doc.links.filter((l) => l.kind === "image").length,
    },
  };
}

/** Offline checks plus remote URL checks. */
export async function inspectFileWithRemote(path: string, opts?: RemoteOptions): Promise<Report> {
  const report = inspectFile(path);
  const doc = parseMarkdown(readFileSync(path, "utf8"));
  report.issues.push(...(await checkRemote(doc, opts)));
  return report;
}
