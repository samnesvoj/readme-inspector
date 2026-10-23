import { posix } from "node:path";
import { checkAnchors, checkRelativeTargets, checkStructure } from "./checks.js";
import { parseMarkdown } from "./parse.js";
import type { Report } from "./report.js";

export interface RepoRef {
  owner: string;
  repo: string;
}

/** Accepts `github:owner/repo`, `owner/repo` with --repo, or a github.com URL. */
export function parseRepoSpec(spec: string): RepoRef | null {
  const m =
    spec.match(/^github:([\w.-]+)\/([\w.-]+)$/) ??
    spec.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1]!, repo: m[2]! } : null;
}

export interface GitHubOptions {
  token?: string;
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

async function api<T>(path: string, opts: GitHubOptions): Promise<T> {
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "readme-inspector",
    "x-github-api-version": "2022-11-28",
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await f(`${opts.apiBase ?? "https://api.github.com"}${path}`, { headers });
  if (!res.ok) {
    const hint = res.status === 404 ? "repository or README not found" : res.status === 403 ? "rate limited — set GITHUB_TOKEN" : "";
    throw new Error(`GitHub API ${res.status} for ${path}${hint ? ` (${hint})` : ""}`);
  }
  return (await res.json()) as T;
}

/** Fetch a repository's README and file tree, then run the offline checks against them. */
export async function inspectRepo(ref: RepoRef, opts: GitHubOptions = {}): Promise<Report> {
  const base = `/repos/${ref.owner}/${ref.repo}`;
  const readme = await api<{ path: string; content: string; encoding: string }>(`${base}/readme`, opts);
  const text = Buffer.from(readme.content, readme.encoding === "base64" ? "base64" : "utf8").toString("utf8");
  const tree = await api<{ tree: { path: string }[]; truncated: boolean }>(`${base}/git/trees/HEAD?recursive=1`, opts);
  const paths = new Set(tree.tree.map((e) => e.path));
  const dir = posix.dirname(readme.path);

  const doc = parseMarkdown(text);
  const exists = (p: string) => {
    if (tree.truncated) return true; // cannot prove absence on huge repositories
    const full = posix.normalize(p.startsWith("/") ? p.slice(1) : posix.join(dir, p)).replace(/\/$/, "");
    return full === "." || paths.has(full);
  };
  return {
    file: `github:${ref.owner}/${ref.repo}/${readme.path}`,
    issues: [...checkStructure(doc), ...checkRelativeTargets(doc, exists), ...checkAnchors(doc)],
    stats: {
      headings: doc.headings.length,
      links: doc.links.filter((l) => l.kind === "link").length,
      images: doc.links.filter((l) => l.kind === "image").length,
    },
  };
}
