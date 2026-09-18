# Future work: blob classification of Instances and opaque types

Part of the [surge](../architecture.md) design. **This is a correctness bug
in shipped behavior:** `Instance` fields are not passed through the blob
channel as documented; they are walked structurally.

## What

Type Coverage in [transformer.md](../transformer.md) lists `unknown`,
`Instance` and its subclasses, and "any other type this design can't
structurally encode" as `blob`. The walker (`walk.ts`) only classifies a
type as `blob` when it has zero properties and no index signature.
`Instance` has hundreds of properties, so it is walked as an object.

Confirmed by executing the compiled walker with `@rbxts/types` loaded:

- `interface T { inst: Instance; part: BasePart }` produces roughly 35 KB
  of IR: two recursion helpers (`surge_Instance_*`, `surge_BasePart_*`),
  `Archivable` as a `bool`, every event as an object of blob-typed
  `Connect`/`Once`/`Wait` fields, and every method as a `blob`. At runtime
  `serialize` would push dozens of functions into `blobs` and
  `deserialize` would return a plain table, not an Instance.
- `Vector2`, `UDim2`, and `BrickColor` are walked structurally the same
  way (`BrickColor.Name` becomes a literal union of every brick color
  name; `Vector2.Unit` makes `Vector2` recursive). The same applies to
  every other Roblox datatype not in `ROBLOX_SCALAR_KINDS` (`UDim`,
  `Rect`, `NumberRange`, `Region3`, `Vector3int16`, `TweenInfo`, `Font`,
  `Ray`, `DateTime`, ...).
- A template literal string type (`` `id-${number}` ``) is walked as the
  apparent members of `String` (blobs for every method); `bigint` and
  `symbol` behave the same. `null` becomes a blob.
- `ROBLOX_SCALAR_KINDS` matches by symbol _name_: a user-declared
  `interface Vector3 { foo: string }` classifies as `vector3`. This is the
  name-matching Transformer Design §1 rejects for factory detection.

Silent-but-wrong classifications that are not crashes:

- Function-typed properties and methods become `blob` with no warning. In
  process that round-trips a function reference; over a `RemoteEvent` it is
  meaningless.
- An empty object type (`{}`, `interface Empty {}`) becomes a `blob`
  instead of a zero-byte object.
- A type with declared properties _and_ an index signature
  (`{ a: number; [k: string]: number }`) drops the index signature.

None of this is covered by tests: there is no `Instance`, `unknown`, or
function-typed fixture anywhere in either repository, and the Lune runner
has no fake `Instance` a fixture could use.

## Why deferred

Needs an identity-based notion of "Roblox class" and "Roblox datatype"
(resolved through the checker against `@rbxts/types`' own declarations),
plus a decision on which unsupported types are diagnostics and which are
implicit blobs. That is a design change to the walk, not a patch.

## How, briefly

- Simplest fix first, the one fbs and serio both use: route any type
  carrying a `_nominal_*` property (the brand `@rbxts/types` puts on every
  datatype and on `Instance`) to the side table. That covers every
  structural row in [type-coverage-parity.md](type-coverage-parity.md) at
  once; real encodings for the cheap datatypes can follow one at a time.
- Alternatively classify a type as `blob` when it is assignable to
  `@rbxts/types`' `Instance` (via `checker.isTypeAssignableTo` against
  the resolved `Instance` type), or is `unknown`/`any`/`defined`.
- Detect datatypes by declaration origin (nearest `package.json` is
  `@rbxts/types`, reusing `nearestPackageName` from `detect.ts`) and
  declared name, not by bare symbol name. Add the common missing ones
  (`Vector2`, `UDim`, `UDim2`, `NumberRange`, `Rect`, `Vector3int16`,
  `BrickColor` as `u16`) and report a diagnostic for the rest.
- Report a diagnostic, not a silent blob, for functions, `symbol`,
  `bigint`, `null`, template literal types, and property-plus-index
  signature objects, pointing at `unknown` as the explicit opt-in.
- Encode an empty object as zero bytes.
- Tests: walker fixtures for each line above; a blob round-trip fixture
  in `coverage.spec.ts` (an `unknown` field holding a table is enough
  under Lune; an `Instance` fixture needs the runner to expose a fake
  Instance class).
