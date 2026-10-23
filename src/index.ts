import { readFileSync } from "node:fs";
import { checkLocalFiles, checkStructure } from "./checks.js";
import { parseMarkdown } from "./parse.js";
import type { Report } from "./report.js";

export { parseMarkdown } from "./parse.js";
export { checkLocalFiles, checkStructure } from "./checks.js";
export type { Issue, Severity } from "./checks.js";
export { formatText, exitCode } from "./report.js";
export type { Report } from "./report.js";

/** Run every offline check against a README file. */
export function inspectFile(path: string): Report {
  const doc = parseMarkdown(readFileSync(path, "utf8"));
  return {
    file: path,
    issues: [...checkStructure(doc), ...checkLocalFiles(doc, path)],
    stats: {
      headings: doc.headings.length,
      links: doc.links.filter((l) => l.kind === "link").length,
      images: doc.links.filter((l) => l.kind === "image").length,
    },
  };
}
