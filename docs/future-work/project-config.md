# Future work: project-level options

Part of the [surge](../architecture.md) design.

## What

A setting that applies to every call site a project compiles, such as a
project default for `readChecks` and `writeChecks`, carried on the
transformer's `tsconfig.json` plugin entry. roblox-ts passes the entry's
other keys to the transformer as the `config` argument of its entry point in
`src/index.ts`, which the transformer receives and ignores today. A
call-site literal would still win over the project default.

## Why deferred

- No consumer needs it yet. The one driver in sight is checks on in a
  development build and off in a release build, which the literal at the call
  site (Runtime API 3.8, [specs/runtime-api.md](../specs/runtime-api.md))
  cannot express. It needs a consumer who builds the two from one source.
- A setting that changes a byte is ruled out, not deferred: a default number
  width, a vector width, packing or a rotation form. A type alone determines
  its encoding (Wire format 10.1, [specs/wire-format.md](../specs/wire-format.md)),
  so two projects compiling one shared type write the same bytes. A
  project-wide default would make them differ. What varies an encoding is
  written in the type, as a brand ([data-types.md](../data-types.md)).
- A separate file, such as `surge.config.json`, is not the vehicle. The
  plugin entry already reaches the transformer, and is where the other
  roblox-ts transformers take their options. A file adds discovery across
  the tsconfigs of one repository and a schema to validate, and gives a reader
  a second place to look.
- Every planned addition is written at the call site
  ([guard-brands.md](guard-brands.md), [enum-name-keys.md](enum-name-keys.md),
  [raw-reads.md](raw-reads.md), [schema-fingerprint.md](schema-fingerprint.md)),
  so a reader of a call site sees what its codec does.

## How, briefly

- Read the `config` argument in `src/index.ts`, reject a key or a value it
  does not know with a diagnostic, and fold the project default into
  `readOptions` where a call site leaves the option out.
- Transformer 3.3 gains the default and its precedence; the transformer's
  suites gain a project with the entry set, and `surge/test/golden.test.mjs` a
  serializer that carries the checks without naming them.
- [getting-started.md](../getting-started.md) shows the entry.
