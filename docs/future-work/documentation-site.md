# Future work: documentation site and API reference

Part of the [surge](../architecture.md) design.

## What

A reader on GitHub sees the documentation on `master` unless they switch to
a tag, so after the first release a page can describe behavior that the
release they installed does not have. Nothing publishes the documentation,
and there is no API reference.

The plan publishes the user documentation as a site, built at each release:

- The five user pages, [getting-started.md](../getting-started.md) and the
  four it links to, move into `docs/guide/`. The contributor pages,
  `specs/`, `research/`, `benchmarks/` and `future-work/` stay where they
  are.
- An API reference is generated from `@rbxts/surge`'s exports and their doc
  comments. The transformer has no API beyond its `tsconfig.json` entry,
  which the guide covers.
- The site is static, so it can be hosted on GitHub Pages or on the
  maintainer's own site. Only the deploy step differs.

## Why deferred

The site publishes a release, so it lands with the first one
([ci-and-release.md](ci-and-release.md)). That release comes after
[single-repository.md](single-repository.md), which sets where `docs/` lives
and which workflow deploys the site.

## How, briefly

- Four papers link to user pages that would move: `native-code-limits.md`
  to `performance.md`, and `per-element-encode.md`, `read-checks-cost.md`
  and `sized-read-tables.md` to `errors-and-guarantees.md`. These are five
  links. [research/README.md](../research/README.md) allows a paper only an
  appended correction, so the move either appends one to each paper, or
  first amends that rule to allow a link-target update when a file moves.
- The user pages link into `specs/`, `research/` and `benchmarks/`, and
  `performance.md` alone links eleven papers. The build rewrites each link
  that leaves `docs/guide/` to the file on GitHub at the release's tag.
- [contributing-docs.md](../contributing-docs.md) names the user pages, and
  the index in `AGENTS.md` and the root `README.md` link to them. All three
  change with the move.
- The API reference: TypeDoc over `@rbxts/surge`'s entry point. First check
  that TypeDoc accepts roblox-ts sources, which compile with `noLib` against
  types in `node_modules/@rbxts`. A doc comment links to the Runtime API
  specification rather than restating it, because a statement lives in one
  document. TypeDoc writes HTML of its own, or Markdown through
  `typedoc-plugin-markdown` for a Markdown-based builder.
- The builder is open. Jekyll adds no toolchain. MkDocs Material or
  VitePress add search and a tool in `mise.toml`.
- Deploy from a job in the release workflow
  ([single-repository.md](single-repository.md)), and by
  `workflow_dispatch` to redeploy. A workflow that runs on a tag push would
  not start, because a tag that CI pushes with `GITHUB_TOKEN` starts no
  workflow run. Build the site on every pull request too, so a broken build
  fails before merge. On GitHub Pages, setting the Pages source to GitHub
  Actions is a one-time repository setting.
- The site shows the latest release. An earlier release stays readable on
  GitHub at its tag.
