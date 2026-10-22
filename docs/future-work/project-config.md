# Future work: project-level options

Part of the [surge](../architecture.md) design.

## What

Settings that apply to every call site a project compiles, carried on the
transformer's `tsconfig.json` plugin entry. roblox-ts passes the entry's
other keys to the transformer as the `config` argument of its entry point in
`src/index.ts`, which the transformer receives and ignores today. Neither
kind changes a byte:

- **Strict rules**: named diagnostics, each off by default, that reject a
  construct the transformer accepts today because it is redundant, does
  nothing, or silently falls back to something a reader may not expect.
- **A project default for `readChecks` and `writeChecks`**. A call-site
  literal would still win over it.

The candidates for strict rules, each accepted today with no diagnostic:

| Group                         | Candidates                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A brand replaced or redundant | `Packed<T>` inside a packed subtree; `DataType.f64`, `Vector<DataType.f32>` and `Transform<DataType.f32>`, which walk to the unbranded field (rule 4 of [coding-standards.md](../coding-standards.md)); a default-width `Transform` inside `Packed<T>`; `Quantized<Quantized<CFrame>>`; `Range<DataType.u8, 0, 255>`, whose range is its width's own; a `Length` or `Exact` around another (Transformer 4.17) |
| A brand that saves nothing    | `Packed<T>` with nothing in it to pack; `Range<number, 0, 1e10>`, which stays `f64`; `Range<number, 5, 5>`, 1 byte where the literal `5` takes none; `Exact<T, 0>`; a property typed `undefined` or `void`, which writes nothing, as `never` is already reported as removable (Transformer 4.8)                                                                                                               |
| A value sent as a blob        | `unknown`, `any`, `{}`, `object`, `defined`, an `Instance`, a Roblox type surge does not encode such as `TweenInfo`, and a union with such a member (Transformer 4.1, 4.4 and 7.1). Instances and the other types could be separate rules                                                                                                                                                                     |
| A default left implicit       | a plain `number`, which is `f64` (Transformer 4.1); a container with no `Length` or `Exact`, whose count is variable-length (Wire format 6.9)                                                                                                                                                                                                                                                                 |

Two cases are likely diagnostics for every build, not strict rules:

- A `Vector3` or `CFrame` intersected with a brand of the project's own, as
  in `Vector3 & { readonly __brand?: "p" }`, or an interface that extends
  one, is a `blob` instead of 12 or 24 bytes. Nothing states it: the 4.1
  rows match only the declaration in `@rbxts/types`, and `_nominal_Vector3`
  then matches the blob row.
- An intersection of brands where none wraps the others has no outermost
  brand (Transformer 4.3), so none of them applies:
  `Vector<DataType.i16> & Vector<DataType.u8>` is a `blob`, and
  `Length<string[], DataType.u8> & Length<string[], DataType.u16>` reports a
  diagnostic that names neither brand.
- An unknown key or value in the plugin entry, a typo included, is ignored
  today. The setting rejects it.

## Why deferred

- The strict rules need choosing first: which candidates become rules, and
  how they are grouped. Each rule rejects only a build that opts in, so a
  rule can land after the first release without breaking anyone.
- No consumer needs the checks default yet. Its one driver is checks on in a
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
- Every planned option that changes what a codec does is written at the call
  site ([guard-brands.md](guard-brands.md), [enum-name-keys.md](enum-name-keys.md),
  [raw-reads.md](raw-reads.md), [schema-fingerprint.md](schema-fingerprint.md)),
  so a reader of a call site sees what its codec does. A strict rule changes
  no codec: it only rejects a build.

## How, briefly

- Read the `config` argument in `src/index.ts`, and reject a key or a value
  it does not know with a diagnostic. That diagnostic has no node in the
  program to point at, so Transformer 7.4 gains a position for it.
- Each strict rule is a key of its own rather than one `strict` flag. Blobs
  are deliberate and widely used, and a rule that every `number` names its
  width cannot stand beside one that rejects `DataType.f64` as redundant: a
  project picks one. Each check sits where the walk already decides the
  case, and reports through the walk's diagnostics (Transformer 7.2).
- `Packed<T>` with nothing to pack counts what packs at the brand's own
  position as well as below it: in `{ a: Packed<boolean>; b: number }`, `a`
  is a bit of its parent's packed region.
- Fold the checks default into `readOptions` where a call site leaves the
  option out. Transformer 3.3 gains the default and its precedence; the
  transformer's suites gain a project with the entry set, and
  `surge/test/golden.test.mjs` a serializer that carries the checks without
  naming them.
- Transformer 7 states each rule, [supported-types.md](../supported-types.md)
  and [data-types.md](../data-types.md) what it rejects, and
  [getting-started.md](../getting-started.md) shows the entry.
