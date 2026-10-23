import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { headingSlugs, type ParsedDoc } from "./parse.js";

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  rule: string;
  message: string;
  line: number;
}

const isRemote = (url: string) => /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");

/** Structural rules: title, heading hierarchy, link text, image alt text. */
export function checkStructure(doc: ParsedDoc): Issue[] {
  const issues: Issue[] = [];
  const h1 = doc.headings.filter((h) => h.level === 1);
  if (doc.headings.length === 0) {
    issues.push({ severity: "warning", rule: "no-headings", message: "README has no headings", line: 1 });
  } else if (h1.length === 0) {
    issues.push({ severity: "warning", rule: "missing-title", message: "README has no top-level (#) title", line: 1 });
  } else if (h1.length > 1) {
    for (const h of h1.slice(1)) {
      issues.push({ severity: "warning", rule: "multiple-titles", message: `extra top-level heading "${h.text}"`, line: h.line });
    }
  }

  let prev = 0;
  for (const h of doc.headings) {
    if (prev && h.level > prev + 1) {
      issues.push({
        severity: "warning",
        rule: "heading-skip",
        message: `heading level jumps from h${prev} to h${h.level} ("${h.text}")`,
        line: h.line,
      });
    }
    if (h.text === "") issues.push({ severity: "warning", rule: "empty-heading", message: "empty heading", line: h.line });
    prev = h.level;
  }

  for (const l of doc.links) {
    if (l.url === "") {
      issues.push({ severity: "error", rule: "empty-url", message: `${l.kind} with an empty URL`, line: l.line });
    }
    if (l.kind === "link" && l.source === "markdown" && l.text.trim() === "") {
      issues.push({ severity: "warning", rule: "empty-link-text", message: `link to ${l.url} has no text`, line: l.line });
    }
    if (l.kind === "image" && l.source === "markdown" && l.text.trim() === "") {
      issues.push({ severity: "warning", rule: "image-alt", message: `image ${l.url} has no alt text`, line: l.line });
    }
  }
  for (const r of doc.undefinedRefs) {
    issues.push({ severity: "error", rule: "undefined-reference", message: `reference [${r.label}] is never defined`, line: r.line });
  }
  return issues;
}

/** decodeURIComponent that keeps the raw text when it is not valid percent-encoding (e.g. "100%.md"). */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Local links and images must point at files that exist next to the README. */
export function checkLocalFiles(doc: ParsedDoc, readmePath: string): Issue[] {
  const base = dirname(resolve(readmePath));
  return checkRelativeTargets(doc, (path) =>
    existsSync(path.startsWith("/") ? resolve(base, "." + path) : resolve(base, path)),
  );
}

/** Shared rule for relative links: `exists` receives the decoded path as written in the README. */
export function checkRelativeTargets(doc: ParsedDoc, exists: (path: string) => boolean): Issue[] {
  const issues: Issue[] = [];
  for (const l of doc.links) {
    if (!l.url || isRemote(l.url) || l.url.startsWith("#")) continue;
    const path = safeDecode(l.url.replace(/[?#].*$/, ""));
    if (path === "") continue;
    if (!exists(path)) {
      issues.push({
        severity: "error",
        rule: l.kind === "image" ? "missing-image" : "broken-local-link",
        message: `${l.kind === "image" ? "image" : "link"} target not found: ${l.url}`,
        line: l.line,
      });
    }
  }
  return issues;
}

/** In-page links (#section) must match a heading slug or an explicit HTML anchor. */
export function checkAnchors(doc: ParsedDoc): Issue[] {
  const targets = new Set([...headingSlugs(doc.headings), ...doc.anchors.map((a) => a.toLowerCase())]);
  const issues: Issue[] = [];
  for (const l of doc.links) {
    if (!l.url.startsWith("#") || l.url === "#") continue;
    const id = safeDecode(l.url.slice(1)).toLowerCase();
    if (!targets.has(id)) {
      issues.push({ severity: "error", rule: "broken-anchor", message: `no heading or anchor matches ${l.url}`, line: l.line });
    }
  }
  return issues;
}
