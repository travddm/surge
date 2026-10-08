# Future work: shared tool configs

Part of the [surge](../architecture.md) design.

## What

The root and each package keep their own `.prettierrc`,
`.markdownlint.json` and `cspell.json`. The packages' `.prettierrc` and
`.markdownlint.json` are identical, the root's `.prettierrc` is surge's
without the import-sorting plugin, and the root's `cspell.json` word list
began as a copy of surge's. A setting changed in one copy has to be changed
in the others by hand.

## Why deferred

Each copy works, and the move into one repository did not need them
shared.

## How, briefly

- Check how each tool finds a config outside the directory it runs in
  before moving one. Prettier looks for a config from each file's directory
  upward, so a root `.prettierrc` would cover both packages, but the
  import-sorting plugin it names must then resolve from the root, whose npm
  project does not install it.
- Share one word list for cspell: the root's and each package's
  `cspell.json` can `import` a common file, and each keeps its own `files`
  and `ignorePaths`.
