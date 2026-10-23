/** Lightweight Markdown scanner: extracts headings, links and images with line numbers. */

export type LinkKind = "link" | "image";

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export interface Link {
  kind: LinkKind;
  /** Where the link came from: Markdown syntax or an HTML tag. */
  source: "markdown" | "html";
  url: string;
  text: string;
  line: number;
}

export interface ParsedDoc {
  headings: Heading[];
  links: Link[];
  /** Explicit HTML anchors: id="..." and <a name="...">. */
  anchors: string[];
  /** Reference labels used as [text][label] that have no definition. */
  undefinedRefs: { label: string; line: number }[];
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const ATX = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const REF_DEF = /^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/;
const INLINE = /(!?)\[((?:\\.|[^\]\\])*)\]\(\s*<?([^\s)>]*)>?(?:\s+["'(][^)]*["')])?\s*\)/g;
const REF_USE = /(!?)\[((?:\\.|[^\]\\])+)\]\[([^\]]*)\]/g;
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
const HTML_HEADING = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
const HTML_ANCHOR = /<[a-z][^>]*?\b(?:id|name)\s*=\s*["']([^"']+)["']/gi;
const HTML_ATTR = /<(a|img|source)\b[^>]*?\b(href|src|srcset)\s*=\s*["']([^"']+)["']/gi;

/** Replace inline code spans with spaces so their contents are never parsed. */
function blankInlineCode(line: string): string {
  return line.replace(/(`+)([\s\S]*?)\1/g, (m) => " ".repeat(m.length));
}

const normLabel = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function parseMarkdown(source: string): ParsedDoc {
  const lines = source.split(/\r?\n/);
  const headings: Heading[] = [];
  const links: Link[] = [];
  const anchors: string[] = [];
  const refDefs = new Map<string, string>();
  const refUses: { kind: LinkKind; label: string; text: string; line: number }[] = [];

  let fence: string | null = null;
  const prose: string[] = []; // the document with code lines blanked, for multi-line HTML
  let prevBlank = true;
  let inIndentedCode = false;
  lines.forEach((raw, i) => {
    prose.push("");
    const lineNo = i + 1;
    const f = raw.match(FENCE);
    if (f) {
      const marker = f[1]!;
      if (fence === null) fence = marker[0]!.repeat(marker.length);
      else if (marker.startsWith(fence)) fence = null;
      return;
    }
    if (fence !== null) return;
    // Indented code: 4+ spaces or a tab, but (as in CommonMark) it cannot interrupt a paragraph,
    // and indented lines that start with an HTML tag belong to an HTML block.
    const indented = /^( {4}|\t)/.test(raw) && raw.trim() !== "";
    if (indented && (inIndentedCode || prevBlank) && !raw.trimStart().startsWith("<")) {
      inIndentedCode = true;
      return;
    }
    inIndentedCode = false;
    prevBlank = raw.trim() === "";

    const line = blankInlineCode(raw);
    prose[i] = line;

    const def = line.match(REF_DEF);
    if (def) {
      refDefs.set(normLabel(def[1]!), def[2]!);
      return;
    }

    // Heading text comes from the raw line so inline code like `npm test` is kept.
    const h = line.match(ATX) ? raw.match(ATX) : null;
    if (h) headings.push({ level: h[1]!.length, text: h[2]!.trim(), line: lineNo });
    for (const m of line.matchAll(HTML_ANCHOR)) anchors.push(m[1]!);

    for (const m of line.matchAll(INLINE)) {
      links.push({ kind: m[1] ? "image" : "link", source: "markdown", text: m[2]!, url: m[3]!, line: lineNo });
    }
    for (const m of line.matchAll(REF_USE)) {
      const label = m[3] === "" ? m[2]! : m[3]!;
      refUses.push({ kind: m[1] ? "image" : "link", label, text: m[2]!, line: lineNo });
    }
    for (const m of line.matchAll(AUTOLINK)) {
      links.push({ kind: "link", source: "markdown", text: m[1]!, url: m[1]!, line: lineNo });
    }
    for (const m of line.matchAll(HTML_ATTR)) {
      const tag = m[1]!.toLowerCase();
      const kind: LinkKind = tag === "a" ? "link" : "image";
      // srcset may hold "url 2x, url2 1x" — take each candidate URL
      const urls = m[2]!.toLowerCase() === "srcset" ? m[3]!.split(",").map((c) => c.trim().split(/\s+/)[0]!) : [m[3]!];
      for (const url of urls) if (url) links.push({ kind, source: "html", text: "", url, line: lineNo });
    }
  });

  // HTML headings may span several lines, so they are matched on the whole document.
  const text = prose.join("\n");
  for (const m of text.matchAll(HTML_HEADING)) {
    // <h1><img alt="Project"></h1> is a common logo title: fall back to the alt text.
    const inner = m[2]!;
    const plain = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const alt = inner.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    const line = text.slice(0, m.index).split("\n").length;
    headings.push({ level: Number(m[1]), text: plain || alt.trim(), line });
  }
  headings.sort((a, b) => a.line - b.line);

  const undefinedRefs: ParsedDoc["undefinedRefs"] = [];
  for (const use of refUses) {
    const url = refDefs.get(normLabel(use.label));
    if (url === undefined) undefinedRefs.push({ label: use.label, line: use.line });
    else links.push({ kind: use.kind, source: "markdown", text: use.text, url, line: use.line });
  }
  links.sort((a, b) => a.line - b.line);
  return { headings, links, anchors, undefinedRefs };
}

/** Strip inline Markdown so a heading reads like its rendered text. */
function plainText(md: string): string {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*]/g, "")
    .replace(/(^|\s)_+|_+(\s|$)/g, "$1$2");
}

/** GitHub-compatible heading slugs, including the -1, -2 suffixes for duplicates. */
export function headingSlugs(headings: Heading[]): string[] {
  const seen = new Map<string, number>();
  return headings.map((h) => {
    const base = plainText(h.text)
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
      .replace(/ /g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  });
}
