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
  /** Reference labels used as [text][label] that have no definition. */
  undefinedRefs: { label: string; line: number }[];
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const ATX = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const REF_DEF = /^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/;
const INLINE = /(!?)\[((?:\\.|[^\]\\])*)\]\(\s*<?([^\s)>]*)>?(?:\s+["'(][^)]*["')])?\s*\)/g;
const REF_USE = /(!?)\[((?:\\.|[^\]\\])+)\]\[([^\]]*)\]/g;
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
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
  const refDefs = new Map<string, string>();
  const refUses: { kind: LinkKind; label: string; text: string; line: number }[] = [];

  let fence: string | null = null;
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const f = raw.match(FENCE);
    if (f) {
      const marker = f[1]!;
      if (fence === null) fence = marker[0]!.repeat(marker.length);
      else if (marker.startsWith(fence)) fence = null;
      return;
    }
    if (fence !== null) return;
    if (/^( {4}|\t)/.test(raw) && raw.trim() !== "") return; // indented code block

    const line = blankInlineCode(raw);

    const def = line.match(REF_DEF);
    if (def) {
      refDefs.set(normLabel(def[1]!), def[2]!);
      return;
    }

    const h = line.match(ATX);
    if (h) headings.push({ level: h[1]!.length, text: h[2]!.trim(), line: lineNo });

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

  const undefinedRefs: ParsedDoc["undefinedRefs"] = [];
  for (const use of refUses) {
    const url = refDefs.get(normLabel(use.label));
    if (url === undefined) undefinedRefs.push({ label: use.label, line: use.line });
    else links.push({ kind: use.kind, source: "markdown", text: use.text, url, line: use.line });
  }
  links.sort((a, b) => a.line - b.line);
  return { headings, links, undefinedRefs };
}
