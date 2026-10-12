# Future work: `writeChecks` on a width brand

Part of the [surge](../architecture.md) design.

## What

With `writeChecks: true`, `serialize` raises for a number that its width
brand cannot hold: a value outside the range of a `u8` to `i32`, or a
fraction in any integer width. The same for each component of a
`DataType.Vector<X, Y, Z>` or a `DataType.Transform<X, Y, Z>` whose width is
an integer. A plain `number`, an `f32` and an `f64` hold any number and get
no check. The bytes do not change, and nothing changes without the option.

## Why

Today `writeChecks` examines a number only under `DataType.Range<T, Min, Max>`
(Runtime API 3.11 in [specs/runtime-api.md](../specs/runtime-api.md)). A
`DataType.u8` field given 300 wraps to 44 with the option on, and the
documented way to have it checked is `Range<DataType.u8, 0, 255>`. A user
who turned the checks on has already paid for them, and a width is a range
the type states. [data-types.md](../data-types.md),
[errors-and-guarantees.md](../errors-and-guarantees.md) and the JSDoc of
`Vector` each carry the caveat; this removes it.

## Why deferred

It came out of the API review after that branch's scope was set. Nothing
blocks it. It changes what the option guarantees, so it lands before the
first release, which freezes the consumer API.

## How, briefly

- `writeNum` in `rbxts-transformer-surge/src/emit/write.ts` emits the
  `Range` comparison where `field.range` is set. The simplest form gives a
  `num` whose width a brand set, and that has no `Range`, the width's own
  limits from `WIDTH_LIMITS` as its range in the walk, with `whole` set for
  an integer width. The emitter is then unchanged, and the walk's tests pin
  the new field.
- The components of a `vector3` and a `cframe` position are written through
  `writeNumberAt` in `emit/context.ts`; the comparison goes before each
  component whose width is an integer, under the option only.
- Runtime API 3.10 adds the width case, and 3.11 keeps the wrap without the
  option. Wire format 4.15 and 7.3 say "nothing raises" and gain the
  exception. [errors-and-guarantees.md](../errors-and-guarantees.md)'s table
  and its Writing values section, [data-types.md](../data-types.md)'s Number
  widths and Vector and CFrame widths, [performance.md](../performance.md)'s
  statement of what the option costs, and the `Vector` and `Range` JSDoc in
  `surge/src/data-type.ts` follow.
- `checks.spec.ts` gains a fact per case, and keeps the facts that pin the
  wrap without the option. The catalog has no row that gives `writeChecks`
  code ([benchmark-tooling.md](benchmark-tooling.md)), so the cost of the
  branch stays unmeasured, as the `Range` comparison's is.
