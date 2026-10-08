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
  keep the paths they were written with. The user pages move into a folder
  of their own later, with the documentation site
  ([documentation-site.md](documentation-site.md)).
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
markdownlint-cli2 and cspell, and no `workspaces`, runs them. Before relying
on it, check that a `node_modules/` at the root changes nothing that `tests/`
resolves.

The root gets a `mise.toml` too, as the toolchain for the whole repository:

- mise merges each `mise.toml` with the ones in its parent directories. The
  root pins the tools every package uses, such as Node, and each package
  keeps only its own, such as surge's Rojo, Lune, Blink and Zap.
- Its `ci` task runs the root checks, then each package's `ci`. mise's
  monorepo tasks (`monorepo_root = true`, with `[monorepo] config_roots`
  naming both packages) run a package's task from the root as
  `mise //surge:ci`. Check whether that feature is still experimental
  before relying on it.
- mise's documentation does not say whether `mise install` at the root
  installs the tools that the packages' `mise.toml` files pin, so a root
  setup task may need to run `mise install` in each package.

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
- The checks run on `ubuntu-latest` and on `windows-latest`, the second
  through Git Bash. The maintainer works on Windows, and the mise tasks
  assume a POSIX shell (documented as a VS Code task override), but no CI
  job runs that path today. A tag, a publish or a deploy runs once, on
  Ubuntu, after both pass.
- Delete both `ci/*-ref` files, the transformer's integration job, and the
  pin rules in `AGENTS.md`, `CLAUDE.md`, [contributing.md](../contributing.md)
  and [testing.md](../testing.md).
- One commit replaces each pair of commits: in a specification's
  `Applies to` ([specs/README.md](../specs/README.md)), in a paper's header
  line ([research/README.md](../research/README.md)), and in what the speed
  recorder writes.

### Versions

- Both packages carry one version and are bumped together while surge is
  `0.x`. They meet at the helper ABI that generated code imports from
  `@rbxts/surge/out/abi` (Runtime API 5 and 6 in
  [specs/runtime-api.md](../specs/runtime-api.md)), and most changes so far
  touch both. A fix in one package republishes the other, unchanged, under
  the new version; that is the whole cost.
- Independent versions would need a statement of which runtime versions
  each transformer version works with, and the version backstop in
  [ci-and-release.md](ci-and-release.md) would check that range instead of
  equality. The tags and the publishing below work for either.

### Branches and tags

CI makes every tag, after the checks pass in the same workflow run:

| Branch               | Trigger                                     | CI then makes                                                                                |
| -------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `release`, protected | every push                                  | a staged npm publish; after approval, release tags, a GitHub Release, the documentation site |
| `master`, protected  | every push                                  | pre-release tags                                                                             |
| any branch           | `workflow_dispatch`, with a `dev-tag` input | dev tags, when the input is set                                                              |

A pull request runs the checks only.

- Versions live in commits, and CI never commits. A release's pull request
  into `master` bumps both packages' versions and adds the changelog entry,
  and a second pull request merges `master` into `release`.
- Both branches are protected: each takes pull requests with passing checks
  only. Each push to `master` makes pre-release tags that can never be
  deleted, so nothing reaches `master` without review. `release` takes merge
  commits, never squashes or rebases.
- The release run checks that the version has no tag yet, and stages the
  npm publish. Once the maintainer approves it (Publishing, below), the run
  tags, creates the GitHub Release, deploys the documentation site
  ([documentation-site.md](documentation-site.md)), and prunes dev tags.
  Each is a job of the same workflow, because a tag that CI pushes with
  `GITHUB_TOKEN` starts no workflow run of its own.
- A tag script makes one commit per package with
  `git commit-tree <commit>:<directory>` and tags it. For a pre-release or
  a dev tag, it first writes the tag's version into that tree's
  `package.json`. The commit is on no branch, so nothing else sees the
  change.
- For a release of 0.2.0, the tags are `surge-v0.2.0` and
  `transformer-v0.2.0` on the one-package commits, and `v0.2.0` on the
  commit itself.
- A pre-release takes the next patch, because a pre-release of a version
  that is already out sorts below it: `surge-v0.2.1-next.<N>`, where `N`
  counts the commits on `master` that the latest release tag does not
  contain. That count needs `release` to take merge commits. Pushes to
  `master` tag one at a time (a `concurrency` group), so each `N` is used
  once. Each push to `master` adds two tags.
- A dev tag is `surge-v0.2.1-dev-<short hash>`. The hyphen makes `dev` and
  the hash one identifier of the version. As an identifier of its own, an
  all-digit hash with a leading zero, such as `0123456`, is not a valid
  version.
- A tag ruleset restricts updates and deletions of release and pre-release
  tags, so that nobody moves or deletes one: a consumer's lockfile records a
  tag's commit, not the tag. CI only creates tags, so it needs no bypass.
  The tags CI creates are not signed; the ruleset is what keeps them in
  place. Dev tags are outside the ruleset so that a release can prune them.
- A major or minor release deletes the dev tags whose version is below the
  major or minor release before it. Releasing 0.5.0 after 0.4.0 deletes
  every dev tag below 0.4.0, so a dev tag outlives one more major or minor
  release. A patch release deletes none.
  [contributing.md](../contributing.md) states the rule, because deleting a
  tag breaks a lockfile that records its commit.
- `workflow_dispatch` exists only once the workflow file is on the default
  branch. It can then run against any branch.

### Publishing

- `@rbxts/surge` publishes from `surge/` with `--access public`, and
  `rbxts-transformer-surge` publishes from `rbxts-transformer-surge/`. Each
  package drops `"private": true` and gets a `repository.directory`, and the
  transformer's `repository`, `bugs` and `homepage` point at travddm/surge.
  `prepare` builds the compiled output before a publish, as it does for a
  git install.
- Every publish is staged. The release run uses npm's staged publishing
  (`npm stage publish`), so neither version can be installed until the
  maintainer approves it, on the npm website or with the CLI, with two-factor
  authentication. `npm stage download` fetches a staged tarball for review.
  A published version number can never be used again, even after an
  unpublish, so this review is the last check.
- Staged publishing needs npm 11.15.0 or later, newer than the pinned Node's
  npm, so the release job installs it. It worked on 2026-10-08 with npm
  11.21.0, when the maintainer's npm account claimed both names by staging
  a `0.0.0-claim` version of each and rejecting it:
    - Staging a package that did not exist published a placeholder,
      `0.0.0-stage`, which `latest` points at until the first release.
      Rejecting the staged version left the placeholder.
    - A staged version stayed in validation for one to two minutes before it
      could be approved or rejected. The release run waits for that.
    - Staging asked for no second factor. Rejecting from the CLI asked for a
      sign-in in the browser; the npm website rejects too.
- The run stages with a token the maintainer provides: a granular access
  token, limited to the two packages where npm allows it, with Bypass 2FA
  off. It is a secret of a GitHub environment that only the staging job
  uses. With two-factor authentication required for publishing, such a
  token can stage a publish but not complete one; confirm that with the
  first staged publish.
- A write token lasts at most 90 days, and npm removes direct publishing
  with a granular token in January 2027. Once both packages exist, the run
  moves to trusted publishing (`id-token: write`, with no stored secret).
  Whether a trusted publisher can be limited to staging is not confirmed.
- After staging, the run waits on a second GitHub environment that requires
  the maintainer's approval. The maintainer approves both staged versions on
  npm, then approves the run, which checks that both versions are live
  before it tags anything. Rejecting ends the release with nothing tagged.
  Check whether a rejected version number can be staged again; if not, the
  fix takes the next version.
- To try a release before approving it, install the pre-release tags of the
  `master` commit being released: their trees match the release's, except
  for the version.
- [getting-started.md](../getting-started.md) changes to the registry
  install with the first publish. The changelog, the version backstop and
  the `typescript` peer dependency stay in
  [ci-and-release.md](ci-and-release.md).
- Only a release publishes to npm. A pre-release or a dev build reaches
  another project through its one-package tag.

Not part of the move, and possible after it:

- The transformer's Jest stand-in for surge's declarations,
  `test/fixtures/rbxts-surge/`, could read surge's own declarations.
- The packages' identical `.prettierrc` and `.markdownlint.json`, and a
  shared base for `cspell.json`, could move to the root.
