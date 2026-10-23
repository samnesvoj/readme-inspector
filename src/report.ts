import type { Issue } from "./checks.js";

export interface Report {
  file: string;
  issues: Issue[];
  stats: { headings: number; links: number; images: number };
}

const useColor = (enabled: boolean) => (code: string, s: string) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);

export function formatText(report: Report, color = false): string {
  const c = useColor(color);
  const errors = report.issues.filter((i) => i.severity === "error").length;
  const warnings = report.issues.length - errors;
  const out = [c("1", `readme-inspector · ${report.file}`)];
  out.push(
    c("2", `${report.stats.headings} headings · ${report.stats.links} links · ${report.stats.images} images`),
    "",
  );
  for (const i of [...report.issues].sort((a, b) => a.line - b.line)) {
    const tag = i.severity === "error" ? c("31", "error  ") : c("33", "warning");
    out.push(`  ${c("2", `L${String(i.line).padEnd(4)}`)} ${tag} ${i.message} ${c("2", `(${i.rule})`)}`);
  }
  if (report.issues.length) out.push("");
  out.push(
    errors || warnings
      ? `${c(errors ? "31" : "33", `${errors} error(s), ${warnings} warning(s)`)}`
      : c("32", "✓ no problems found"),
  );
  return out.join("\n");
}

export const exitCode = (report: Report, strict = false) =>
  report.issues.some((i) => i.severity === "error" || (strict && i.severity === "warning")) ? 1 : 0;
