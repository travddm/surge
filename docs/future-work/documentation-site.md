# Future work: documentation site and API reference

Part of the [surge](../architecture.md) design.

## What

A reader on GitHub sees the documentation on `master` unless they switch to
a tag, so after the first release a page can describe behavior that the
release they installed does not have. Nothing publishes the documentation,
and there is no API reference.

The plan publishes all of `docs/` as one site, built at each release, with a
part for each audience:

- **Users:** the five user pages, [getting-started.md](../getting-started.md)
  and the four it links to, moved into `docs/guide/`; the benchmark tables
  in `benchmarks/`; and an API reference generated from `@rbxts/surge`'s
  exports and their doc comments. The transformer has no API beyond its
  `tsconfig.json` entry, which the guide covers.
- **Contributors:** the contributor pages, `specs/`, `research/` and
  `future-work/`.

The site is designed, not just generated: a home page that says what surge
is and shows a first serializer, a logo, theme colors, search and a dark
mode. It is static, so it can be hosted on GitHub Pages or on the
maintainer's own site; only the deploy step and the site's base path
differ.

## Why deferred

The first release waits for the site
([ci-and-release.md](ci-and-release.md)). The site waits for
[single-repository.md](single-repository.md), which sets where `docs/`
lives, which npm project holds the site's tools, and which workflow deploys
it.

## How, briefly

- Build with VitePress. It reads `docs/` in place (`srcDir`), and a relative
  link between Markdown files, such as `../specs/runtime-api.md`, resolves
  as written, so the documents need no change to be published. It has local
  search, a dark mode, and a home-page layout with a hero and feature cards.
  It is a Node tool, a devDependency of the root npm project. Starlight's
  documentation shows links written as site routes only, and Material for
  MkDocs has been in maintenance mode since November 2025.
- The home page is a new `docs/index.md` in that layout. The root
  `README.md` stays the home page on GitHub.
- The navigation has one part per audience. `docs/guide/` keeps the user
  pages apart in the repository and in their URLs. `benchmarks/` stays where
  it is, because the recorders write there and papers link there, and the
  users' part of the navigation lists it.
- Four papers link to user pages that would move: `native-code-limits.md`
  to `performance.md`, and `per-element-encode.md`, `read-checks-cost.md`
  and `sized-read-tables.md` to `errors-and-guarantees.md`. These are five
  links. [research/README.md](../research/README.md) allows a paper only an
  appended correction. In the same change as the move, that rule gains an
  exception: when a file moves, a link to it is updated, because the new
  path changes nothing the paper reports. The move then updates the five
  links.
- [contributing-docs.md](../contributing-docs.md) names the user pages, and
  the index in `AGENTS.md` and the root `README.md` link to them. All three
  change with the move.
- A folder's `README.md` stays a page at its own path, such as
  `/specs/README`. A `rewrites` entry could make it the folder's index page,
  but links would then have to name the rewritten path, and fourteen links
  in `docs/` name a `README.md`.
- Papers link to their data files under `research/data/`: Markdown tables
  and `.tsv` files. The site publishes them, or links them to GitHub at the
  release's tag.
- VitePress compiles each page as a Vue component, so `{{ }}` or a tag-like
  `<Name>` outside code would be read as a template; fenced code blocks are
  exempt. Today every such text in `docs/` is in a fenced block. Building
  the site on every pull request keeps it that way, and `v-pre` escapes a
  case that needs it.
- Check that the code highlighter, Shiki, colors Luau as well as TypeScript.
- The API reference: TypeDoc over `@rbxts/surge`'s entry point, with
  `typedoc-plugin-markdown` and `typedoc-vitepress-theme`, which write
  Markdown pages and a VitePress sidebar into a generated folder at build
  time. First check that TypeDoc accepts roblox-ts sources, which compile
  with `noLib` against types in `node_modules/@rbxts`. A doc comment links
  to the Runtime API specification rather than restating it, because a
  statement lives in one document.
- Deploy from a job in the release workflow
  ([single-repository.md](single-repository.md)), and by
  `workflow_dispatch` to redeploy. A workflow that runs on a tag push would
  not start, because a tag that CI pushes with `GITHUB_TOKEN` starts no
  workflow run. Build the site on every pull request too, so a broken build
  fails before merge. On GitHub Pages, setting the Pages source to GitHub
  Actions is a one-time repository setting, and a project site is served
  under `/surge/`, which is the site's base path; on a domain of its own,
  the base path is `/`.
- The site shows the latest release. An earlier release stays readable on
  GitHub at its tag.
