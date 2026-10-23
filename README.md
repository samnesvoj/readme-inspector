# readme-inspector

A small, dependency-free CLI that audits a README before you publish it: broken local links,
missing images, undefined references and Markdown structure problems — with line numbers.

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

Exit codes: `0` no errors, `1` problems found, `2` usage error (missing file, unknown option).

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

Content inside fenced code blocks, indented code and inline code spans is ignored.

## Use it in CI

```yaml
- run: npx --yes github:samnesvoj/readme-inspector README.md --strict
```

Post the result to the GitHub Actions job summary:

```yaml
- run: npx --yes github:samnesvoj/readme-inspector README.md --format markdown >> "$GITHUB_STEP_SUMMARY"
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
