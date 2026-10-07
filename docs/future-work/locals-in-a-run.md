# Future work: locals in a shared reservation

Part of the [surge](../architecture.md) design.

## What

A shape with many `CFrame` properties can fail to compile. Luau gives a
function 200 locals. Transformer 5.5 in
[specs/transformer.md](../specs/transformer.md) ends a run of properties that
share one reservation before it holds more than 31, and 5.8 puts a large
object's properties in blocks of at most 32 locals. Both count one local for
each property in a run: `runFields` in the transformer's `src/emit/layout.ts`,
and the comment on `ALLOC_RUN_FIELDS` in `src/emit/constants.ts`, which says
so. A run cannot be split across blocks, so a run that declares more gets a
block of its own, and that block's locals add to what is live around it.

A `cframe` outside `Packed<T>` declares five locals in a run on the write
side: the position the run gives it, `position`, `axis`, `angle` and `rv`. A
run of 31 `CFrame` properties declares 155 locals in one block on the write
side, and 156 on the read side. A `DataType.Quantized<CFrame>` declares more.

With rbxts-transformer-surge `a8eb521`, Luau refuses each of these with "Out
of local registers":

- An object of 16 `string` properties and 31 `DataType.Quantized<CFrame>`
  properties.
- `{ meta: Meta; frames: Frames; more: Frames }`, where `Meta` holds 16
  `string` properties and `Frames` holds 31 `CFrame` properties.

An object of 16 `string` properties and 31 `CFrame` properties compiles,
about ten locals short of the limit. One more local for each datatype
property in a run took it past the limit
([research/datatype-values.md](../research/datatype-values.md)).

## Why deferred

It was found while measuring a step 1 change of
[generated-code-performance.md](generated-code-performance.md), and is
recorded here rather than fixed in that change. The fix changes which
properties share a reservation, which is a change to the emitted code of its
own.

## How, briefly

- Have `runFields` count the locals each kind declares in a run, on the side
  that declares more: five or more for a `cframe`, and one for every other
  fixed-size kind. A run of 31 locals then holds six `CFrame` properties.
  Reservation order is byte order, so no byte changes.
- Check what a quantized `CFrame`, and each kind of `datatype`, declares on
  each side, rather than taking it from this document.
- Test it by compiling the shapes above with Luau, such as with Lune's
  `luau.compile`. The emit tests of 5.8 count the `const` lines the emitter
  prints for `f64` properties and nested objects, and none has a `CFrame`.
- No catalog row has a run of more than six `CFrame` properties, so neither
  the speed table nor the code-size table would change.
