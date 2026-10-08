# Future work: one-package tags

Part of the [surge](../architecture.md) design.

## What

A developer who tests an unreleased build of surge in another project
installs it from git. npm cannot install a package from a subdirectory of a
git repository ([architecture.md](../architecture.md)), so each build needs a
tag on a commit whose root is one package's directory: a one-package tag.
Nothing makes one yet, so no project can install either package from a
commit in this repository, and [getting-started.md](../getting-started.md)
gives no install.

CI makes two kinds, each only after the checks pass in the same workflow
run:

| Branch     | Trigger                                     | CI then makes                   |
| ---------- | ------------------------------------------- | ------------------------------- |
| `master`   | every push                                  | pre-release tags                |
| any branch | `workflow_dispatch`, with a `dev-tag` input | dev tags, when the input is set |

Release tags, which the same script makes, come with the release
([ci-and-release.md](ci-and-release.md)).

Both facts this rests on were checked on 2026-10-08 with npm 11.5.2:

- npm ignores a `::path:<subdir>` suffix on a git dependency and installs
  the repository root.
- Two tags pushed to travddm/surge, one on a commit holding only surge's
  files and one on a commit holding only the transformer's, each made with
  `git commit-tree` from one tree, installed into one roblox-ts project
  through `github:travddm/surge#<tag>`. Each package's `prepare` built it,
  and `rbxtsc` compiled a `createCodec` call through the transformer into a
  serializer. The tags were deleted after.

## Why deferred

It lands right after the move into one repository, which it needs: a
one-package commit is made from a package's directory.

## How, briefly

- A tag script makes one commit per package with
  `git commit-tree <commit>:<directory>` and tags it. It first writes the
  tag's version into that tree's `package.json`. The commit is on no branch,
  so nothing else sees the change.
- A pre-release takes the next patch, because a pre-release of a version
  that is already out sorts below it: `surge-v0.2.1-next.<N>` and
  `transformer-v0.2.1-next.<N>`, where `N` counts the commits on `master`
  that the latest release tag does not contain. Before the first release,
  it takes the version in `package.json`, `0.1.0`, and `N` counts every
  commit on `master`.
- Pushes to `master` tag one at a time (a `concurrency` group), so each `N`
  is used once. Each push to `master` adds two tags.
- A dev tag is `surge-v0.2.1-dev-<short hash>`. The hyphen makes `dev` and
  the hash one identifier of the version. As an identifier of its own, an
  all-digit hash with a leading zero, such as `0123456`, is not a valid
  version.
- `workflow_dispatch` exists only once the workflow file is on the default
  branch. It can then run against any branch.
- The tags CI creates are not signed. Protecting release and pre-release
  tags, and pruning dev tags, come with the release
  ([ci-and-release.md](ci-and-release.md)).
- [getting-started.md](../getting-started.md) then gives the install from a
  pre-release tag, until the first release.
