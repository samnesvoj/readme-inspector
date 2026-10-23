# readme-inspector

[![CI](https://github.com/samnesvoj/readme-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/samnesvoj/readme-inspector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

A small, dependency-free CLI and GitHub Action that audits a README before you publish it: broken local links,
missing images, dead anchors, undefined references and Markdown structure problems — with line numbers.
Point it at a file, or at any public GitHub repository without cloning it.

```console
$ readme-inspector examples/broken/README.md
readme-inspector · examples/broken/README.md
2 headings · 1 links · 1 images

  L1    warning README has no top-level (#) title (missing-title)
  L3    warning heading level jumps from h2 to h4 ("Install") (heading-skip)
  L5    warning image assets/screenshot.png has no alt text (image-alt)
  L5    error   image target not found: assets/screenshot.png (missing-image)
  L7    error   reference [changes] is never defined (undefined-reference)
  L7    error   link target not found: CONTRIBUTING.md (broken-local-link)

3 error(s), 3 warning(s)
```

## Why

READMEs rot quietly. Files get renamed and their links break, a heading is reworded and every `#anchor` pointing at
it dies, a screenshot is deleted but still referenced. GitHub renders all of this without complaint.
readme-inspector catches it in milliseconds, offline, with zero runtime dependencies — and optionally checks
external URLs too.

```console
$ readme-inspector github:tldr-pages/tldr
readme-inspector · github:tldr-pages/tldr/README.md
9 headings · 39 links · 4 images

✓ no problems found
```

## Install

Requires Node.js 20 or newer.

```bash
git clone https://github.com/samnesvoj/readme-inspector.git
cd readme-inspector
npm install
npm run build
npm link        # makes `readme-inspector` available on your PATH
```

## Usage

```bash
readme-inspector                 # inspects ./README.md
readme-inspector docs/index.md   # any Markdown file
readme-inspector github:owner/repo                 # a repository's README, no clone needed
readme-inspector https://github.com/owner/repo     # same, from a URL
readme-inspector --strict        # treat warnings as failures (useful in CI)
readme-inspector --check-remote  # also request every http(s) link and image
```

| Option | Description |
|---|---|
| `--check-remote` | request every `http(s)` link and image once (HEAD, falling back to GET) |
| `--timeout <ms>` | per-request timeout for `--check-remote` (default `10000`) |
| `--format <f>` | `text` (default), `json` for scripts, or `markdown` for PR comments and job summaries |
| `--strict` | exit with code 1 on warnings as well as errors |
| `--no-color` | disable ANSI colours |
| `-h`, `--help` | show help |
| `-v`, `--version` | print the version |

Exit codes: `0` no errors, `1` problems found, `2` usage error (missing file, unknown option, GitHub API error).

### GitHub repositories

With `github:owner/repo` the README is fetched through the GitHub API and relative links and images are checked
against the repository's file tree, so you can audit any public project without cloning it. Set `GITHUB_TOKEN`
to avoid the unauthenticated rate limit (60 requests per hour; each inspection uses two).

## What it checks

| Rule | Severity | Description |
|---|---|---|
| `missing-image` | error | a local image (Markdown or HTML `src`/`srcset`) does not exist |
| `broken-local-link` | error | a relative link points at a file that does not exist |
| `broken-anchor` | error | an in-page link like `#usage` matches no heading slug or HTML `id`/`name` anchor |
| `broken-remote-link` | error | with `--check-remote`: a URL returns 404 or 410 |
| `unreachable-link` | warning | with `--check-remote`: timeout, network error or other HTTP error |
| `undefined-reference` | error | `[text][label]` is used but `[label]: url` is never defined |
| `empty-url` | error | a link or image with an empty target |
| `missing-title` | warning | no top-level `#` heading |
| `multiple-titles` | warning | more than one top-level heading |
| `heading-skip` | warning | heading levels jump, e.g. `##` straight to `####` |
| `empty-heading` | warning | a heading with no text |
| `image-alt` | warning | a Markdown image without alt text |
| `empty-link-text` | warning | a link with no visible text |

HTML headings (`<h1>`…`<h6>`, including multi-line ones and logo titles like `<h1><img alt="Name"></h1>`) count as
headings. Content inside fenced code blocks, indented code and inline code spans is ignored.

## Use it in CI

As a GitHub Action — the report also lands in the job summary:

```yaml
- uses: actions/checkout@v4
- uses: samnesvoj/readme-inspector@v0.2.0
  with:
    path: README.md        # default
    strict: true           # fail on warnings too
    check-remote: false    # set true to request external links
```

Or with npx in any CI:

```yaml
- run: npx --yes github:samnesvoj/readme-inspector README.md --strict
```

## Use it as a library

```ts
import { inspectFile, formatText } from "readme-inspector/dist/src/index.js";

const report = inspectFile("README.md");
console.log(formatText(report));
```

## Development

```bash
npm install
npm test          # builds with tsc and runs node:test
```

## License

[MIT](LICENSE)
