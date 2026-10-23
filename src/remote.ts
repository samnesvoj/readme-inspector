import type { Issue } from "./checks.js";
import type { ParsedDoc } from "./parse.js";

export interface RemoteOptions {
  timeoutMs?: number;
  concurrency?: number;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

type Outcome = { ok: true } | { ok: false; status?: number; reason: string };

async function probe(url: string, timeoutMs: number, f: typeof fetch): Promise<Outcome> {
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await f(url, { method, redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "readme-inspector (+https://github.com/samnesvoj/readme-inspector)" } });
    await res.body?.cancel();
    return res.status;
  };
  try {
    let status = await attempt("HEAD");
    // Some servers reject HEAD or need a real request; retry once with GET.
    if (status === 405 || status === 403 || status === 501 || status >= 500) status = await attempt("GET");
    return status < 400 ? { ok: true } : { ok: false, status, reason: `HTTP ${status}` };
  } catch (e) {
    const name = (e as Error).name;
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? `timed out after ${timeoutMs} ms` : (e as Error).message };
  }
}

/** Check every http(s) link and image; each URL is requested once. */
export async function checkRemote(doc: ParsedDoc, opts: RemoteOptions = {}): Promise<Issue[]> {
  const { timeoutMs = 10_000, concurrency = 8, fetchImpl = fetch } = opts;
  const byUrl = new Map<string, number[]>();
  for (const l of doc.links) {
    if (!/^https?:\/\//i.test(l.url)) continue;
    const key = l.url.replace(/#.*$/, "");
    byUrl.set(key, [...(byUrl.get(key) ?? []), l.line]);
  }
  const urls = [...byUrl.keys()];
  const results = new Map<string, Outcome>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++]!;
      results.set(url, await probe(url, timeoutMs, fetchImpl));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));

  const issues: Issue[] = [];
  for (const [url, lines] of byUrl) {
    const r = results.get(url)!;
    if (r.ok) continue;
    const gone = r.status === 404 || r.status === 410;
    for (const line of lines) {
      issues.push(gone
        ? { severity: "error", rule: "broken-remote-link", message: `${url} returned ${r.reason}`, line }
        : { severity: "warning", rule: "unreachable-link", message: `${url}: ${r.reason}`, line });
    }
  }
  return issues;
}
