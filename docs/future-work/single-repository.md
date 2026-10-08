# Future work: one repository for both packages

Part of the [surge](../architecture.md) design.

## What

surge and `rbxts-transformer-surge` are two repositories, and each one's CI
tests the other at a pinned commit (Working across both repositories in
[contributing.md](../contributing.md)). The pins cost every change that
spans both packages:

- It takes three commits in two repositories, pushed in a fixed order, and
  a pull request in each once there is more than one contributor.
- The first of the three runs against the old commit of the other package,
  and can fail when the change is right.
- Each merge of such a change moves the pins again.

The plan moves both packages into this repository, each in a directory of
its own, and tests them together at one commit. Releases come from there:

- **Users** install from the npm registry: `@rbxts/surge`, published under
  the `@rbxts` organization, and `rbxts-transformer-surge`, unscoped and
  outside that organization.
- **Developers** who test a build in another project install a one-package
  tag, `github:travddm/surge#<tag>`: a tag on a commit whose root is one
  package's directory.

The two are separate today because npm cannot install a package from a
subdirectory of a git repository ([architecture.md](../architecture.md)). A
one-package tag works around that. Both facts were checked on 2026-10-08
with npm 11.5.2:

- npm ignores a `::path:<subdir>` suffix on a git dependency and installs
  the repository root.
- Two tags pushed to travddm/surge, one on a commit holding only surge's
  files and one on a commit holding only the transformer's, each made with
  `git commit-tree` from one tree, installed into one roblox-ts project
  through `github:travddm/surge#<tag>`. Each package's `prepare` built it,
  and `rbxtsc` compiled a `createCodec` call through the transformer into a
  serializer. The tags were deleted after.

## Why deferred

The move changes the CI workflow, every contributor document, and how a
release is cut, so it is planned before it is done. It lands before the
first release in [ci-and-release.md](ci-and-release.md), so that the
release procedure is written once, for the layout it runs in.

## How, briefly

### Layout

```text
surge/                        travddm/surge
├── surge/                    @rbxts/surge: src/, test/, tests/, its tooling
├── rbxts-transformer-surge/  the transformer: src/, test/, scripts/, its tooling
├── docs/                     all documentation, as now
├── .github/workflows/        one workflow
├── .githooks/                the pre-push hook
├── AGENTS.md, CLAUDE.md, README.md, LICENSE, .gitattributes
└── surge.code-workspace
```

`surge/tests/package.json` depends on `file:..` and
`file:../../rbxts-transformer-surge`, and the transformer's documents name
`../surge`. In this layout each path still resolves to the same package.
`tests/` stays its own npm project, and there are no npm workspaces
([architecture.md](../architecture.md)).

### What goes where

At the root:

- `.github/`: GitHub reads workflows from the root only.
- `.githooks/`: a repository has one `core.hooksPath`. The two hooks are
  identical; the root one runs the root `mise run ci`.
- `.gitattributes`: identical in both repositories; one covers the tree.
- `docs/`: it documents both packages. No Markdown link in it points at a
  source file, so the move changes only the paths the benchmark recorders
  write: `tests/scripts/` writes to `../docs/benchmarks/`, and surge's
  `bench:*` scripts run Prettier on `docs/benchmarks/`. A path in prose,
  such as `tests/src/tests/`, is relative to its package's directory;
  [contributing-docs.md](../contributing-docs.md) says so once, and papers
  keep the paths they were written with.
- `AGENTS.md` and `CLAUDE.md`: surge's become the repository's, with the
  documentation index, the rules and the commands for both packages. The
  transformer keeps its own pair in its directory for what is particular to
  it, with its GitHub links to surge's documents made relative.
- `README.md`: surge's, as the repository's home page on GitHub.
- `LICENSE`: at the root for GitHub, and a copy in each package's directory.
  npm packs the `README.md` and `LICENSE` in the package's own directory,
  and a one-package tag holds that directory alone. Each package therefore
  keeps a `README.md` too, written for its npm page, with absolute links.
- `surge.code-workspace`: its folders become `surge/` (still first, because
  `js/ts.tsdk.path` resolves against the first folder),
  `rbxts-transformer-surge/`, and the root itself, last, for `docs/` and the
  root files, with the two package directories hidden from it by
  `files.exclude`.
- `.claude/`: untracked local state, kept where Claude Code starts, which is
  the root.

In each package's directory: `package.json`, its lockfile, `node_modules/`,
`tsconfig.json`, `eslint.config.ts`, `.gitignore`, `.vscode/`, `mise.toml`,
`.prettierrc`, `.markdownlint.json` and `cspell.json`. Each package builds,
lints and tests with its own toolchain, and `npm ci` runs once per package.
`ci/` is deleted.

The root files need their own lint, format and spell checks. The commit
message needs one too: each package's `spell` reads `.git/COMMIT_EDITMSG`
from its own root today. A small root npm project with Prettier,
markdownlint-cli2 and cspell, and no `workspaces`, can run them. A root
`mise.toml` then defines `ci` as the root checks followed by each package's
`ci`. Before relying on this, check that a `node_modules/` at the root
changes nothing that `tests/` resolves.

### History

Every commit hash stays. The specifications' `Applies to` lines, the
papers and the speed table cite commits in both repositories, and a paper
changes only by an appended correction. On one branch:

1. In one commit, `git mv` surge's package files into `surge/`, and leave
   the files that belong at the root.
2. Fetch the transformer's `master`, commit a move of all its files into
   `rbxts-transformer-surge/` on top of it, and merge that commit with
   `--allow-unrelated-histories`.
3. Make the changes below, and merge the branch as one change.

Both histories keep their hashes, and `git log --follow` traces a file past
the move. Do not use `git filter-repo --to-subdirectory-filter`: it rewrites
every hash. A local branch made before the move keeps the old paths. Archive
travddm/rbxts-transformer-surge with a README that points here, and do not
delete it, so links to its commits keep working.

### CI

- One workflow runs on every push and pull request, with no path filters,
  so a change to either package is tested with the other at the same
  commit. It installs each package with `npm ci`, checks each lockfile, and
  runs the root checks and then each package's `ci`.
- Delete both `ci/*-ref` files, the transformer's integration job, and the
  pin rules in `AGENTS.md`, `CLAUDE.md`, [contributing.md](../contributing.md)
  and [testing.md](../testing.md).
- One commit replaces each pair of commits: in a specification's
  `Applies to` ([specs/README.md](../specs/README.md)), in a paper's header
  line ([research/README.md](../research/README.md)), and in what the speed
  recorder writes.

### Releases

- Both packages carry one version and are bumped together, because the
  generated code calls the runtime package with no version negotiation
  (Runtime API 6 in [specs/runtime-api.md](../specs/runtime-api.md)).
- Publish `@rbxts/surge` from `surge/` with `--access public`, and
  `rbxts-transformer-surge` from `rbxts-transformer-surge/`. Each package
  drops `"private": true` and gets a `repository.directory`, and the
  transformer's `repository`, `bugs` and `homepage` point at travddm/surge.
  `prepare` builds the compiled output before a publish, as it does for a
  git install.
- A release script takes a commit and makes one commit per package with
  `git commit-tree <commit>:<directory>`. It tags each of those commits,
  for example `surge-v0.2.0` and `transformer-v0.2.0`, and tags the commit
  it was given `v0.2.0`. The maintainer's git configuration signs every
  tag, so the script makes signed tags.
- A one-package tag must never move or be deleted, because a consumer's
  lockfile records the tag's commit, not the tag.
- [getting-started.md](../getting-started.md) changes to the registry
  install with the first publish. The release procedure, the changelog and
  the version backstop stay in [ci-and-release.md](ci-and-release.md).

Open:

- Whether developers get one-package tags only for releases, or also for
  unreleased commits under a prefix that marks them as not releases.
- Whether a release publishes from CI or by hand.

Not part of the move, and possible after it:

- The transformer's Jest stand-in for surge's declarations,
  `test/fixtures/rbxts-surge/`, could read surge's own declarations.
- The packages' identical `.prettierrc` and `.markdownlint.json`, and a
  shared base for `cspell.json`, could move to the root.
