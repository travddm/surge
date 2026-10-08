# Future work: cross-repository CI and release discipline

Part of the [surge](../architecture.md) design.

## What

- **No version backstop.** Nothing checks, at compile time or at run time,
  that a consumer's two `github:` refs match (Runtime API 6.2 in
  [specs/runtime-api.md](../specs/runtime-api.md)); keeping them matched is
  release-process discipline. The transformer already reads
  `@rbxts/surge`'s `package.json` (`nearestPackageName` in `detect.ts`)
  to identify the package; reading its `version` too and reporting a
  diagnostic when it differs from the transformer's own version is a
  small, cheap backstop. Neither repository has a tag yet, both are
  `0.1.0`, and there is no documented tagging step. The transformer's
  `package.json` is also `"private": true`.
- **No Windows job.** The maintainer develops on Windows and the mise
  tasks assume a POSIX shell (documented as a VS Code task override);
  nothing exercises that path automatically.
- **No release documentation.** There is no `CHANGELOG`, no tagging
  procedure, and no statement of which Roblox, roblox-ts and `@rbxts/types`
  versions the generated code targets. [getting-started.md](../getting-started.md)
  asks a consumer to pin both repositories to the same release, and neither
  has one yet.
- **No documentation site.** A reader on GitHub sees the documentation on
  `master` unless they switch to a tag, so after the first release a page
  can describe behavior that the release they pinned does not have. GitHub
  Pages is not enabled on this repository.

## Why deferred

Each item is a workflow change rather than a code change; the version
backstop is the only one that touches the transformer, and it should land
with the first tagged release it would protect. The documentation site
publishes a release, so it lands with the first one too. The Windows job
has no such dependency, and [README.md](README.md) lists it as work that can
land at any time.

## How, briefly

- Emit a diagnostic from the transformer when the resolved `@rbxts/surge`
  version does not equal the transformer's own; document a release
  procedure that bumps both `package.json` versions and tags both
  repositories together, with a `CHANGELOG.md` entry, and state the
  targeted roblox-ts and `@rbxts/types` versions in
  [getting-started.md](../getting-started.md).
- Publish the documentation to GitHub Pages with each release: a
  `pages.yml` workflow, run when a release tag is pushed and by
  `workflow_dispatch`, that builds the site and deploys it with
  `deploy-pages`. The site shows the latest release; an earlier one stays
  readable on GitHub at its tag. Build the site in `ci.yml` on every pull
  request too, so a broken build fails before merge. Setting the Pages
  source to GitHub Actions is a one-time repository setting.
- The user pages link into `specs/`, `research/` and `benchmarks/`, so the
  site includes those or rewrites the links to GitHub. Whether contributor
  pages and `future-work/` are published is open. The root `README.md` is
  the home page and its Documentation list is the navigation, so the site
  adds no index beside `AGENTS.md`. The builder is open: Jekyll adds no
  toolchain; MkDocs Material or VitePress add search and a tool in
  `mise.toml`.
- Add a `windows-latest` matrix entry running the same steps through Git
  Bash.
