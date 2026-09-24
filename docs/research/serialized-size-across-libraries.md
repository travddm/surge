# Serialized size across five libraries

2026-09-23 · surge `5d843a7` · rbxts-transformer-surge `aa6f04b` · Lune 0.10.5

## Abstract

On a sixteen-row catalog, surge writes the same bytes as flamework-binary-
serializer (fbs) on fourteen rows and as serio on every row without a
`CFrame`. Blink and Zap are smaller wherever a length prefix appears, and
every byte of every difference is that prefix: they default an unbounded
string, array or map to a u16 count where surge writes u32. surge's one clear
size win is `Packed<T>` on axis-aligned rotations, 654 bytes against 1179 and
904, and the only exact round trip of the three, because fbs and serio find
an axis-aligned rotation by exact equality against a table and 47 of the
row's 50 rotations miss it. Size, unlike speed, is deterministic, so none of
this depends on the run it was read from.

## Background

surge is meant as a drop-in alternative to fbs with the same encodings, so
byte-for-byte agreement with fbs is the expected result and every
disagreement is either a deliberate difference or a defect. Blink and Zap are
IDL compilers with their own formats; serio is another roblox-ts serializer.
The size tier runs the whole catalog under Lune, through a shim that stands
in for the Roblox `Instance` API, and records each library's bytes for one
sample value of each row alongside how far a decode moved that value.

## Method

`mise run bench:size` encodes one seeded sample value per row with each
library's adapter, records the buffer's length and any side-table entries,
decodes it, and compares the result with the input component by component.
Every library encodes the same value. Blink needs `.blink` twins of the rows
it can express; Zap has no callable encoder, so its bytes are one event fired
at a mocked remote, minus the event-id byte. A missing cell means the library
cannot express the row.

The table is regenerated at the commit above and matches the committed
`docs/benchmarks/size.md` byte for byte. The recorder writes no date or
machine into it, so it changes only when an encoding does.

## Results

Bytes per row:

| Fixture                             | surge | fbs  | serio | blink | zap  |
| ----------------------------------- | ----- | ---- | ----- | ----- | ---- |
| small flat struct                   | 17    | 17   | 17    | 17    | 17   |
| deeply nested object                | 24    | 24   | 24    | 20    | 20   |
| wide struct                         | 200   | 200  | 200   | 200   | 200  |
| large array                         | 2004  | 2004 | 2004  | 2002  | 2002 |
| large record                        | 2096  | 2096 | 2096  | 1694  | 1695 |
| string-heavy                        | 2390  | 2390 | 2390  | 2184  | 2184 |
| enum-heavy                          | 106   | 106  | 106   | —     | —    |
| tagged union                        | 1274  | 1274 | 1274  | 1228  | 1228 |
| guarded union                       | 849   | 849  | 849   | —     | 783  |
| toggles (unpacked)                  | 26    | 26   | 26    | 24    | —    |
| toggles (packed)                    | 16    | 16   | 16    | —     | 14   |
| CFrame array                        | 1204  | 1204 | 904   | 1202  | 1202 |
| CFrame array (packed, axis-aligned) | 654   | 1179 | 904   | —     | —    |
| CFrame array (packed, arbitrary)    | 1254  | 1212 | 919   | —     | —    |
| Blink: Booleans                     | 1004  | 1004 | 1004  | 1002  | 1002 |
| Blink: Entities                     | 604   | 604  | 604   | 602   | 602  |

`docs/benchmarks/size.md` carries the same figures with ratios, each row's
description, and the round-trip error per library.

**surge and fbs** agree on fourteen of sixteen rows, including the unpacked
`CFrame`. The two they differ on are both `Packed<T>` rotations.

**serio** matches both on every row without a `CFrame`. On the unpacked
`CFrame` row it is 904 bytes against 1204, because it writes a 6-byte
quantized axis-angle where surge and fbs write 12 bytes of f32, and that
costs it about 1e-4 per rotation component against about 2e-7 of f32
rounding for the other two.

**The axis-aligned `Packed<T>` row** is 654 bytes for surge against 1179 for
fbs and 904 for serio. Both of the others look an axis-aligned rotation up by
exact `CFrame` equality against a table of 24 built from `CFrame.Angles`. Only
3 of the row's 50 rotations, the ones built from unit axes, are exactly equal
to an entry; the byte deltas agree, since a match saves 11 bytes under fbs and
5 under serio, which is exactly the gap between each library's two packed
`CFrame` rows. The other 47 fall back to each library's general rotation
form. serio's fallback loses a rotation about the X axis outright — that
row's worst component moves by 1.0 — because the scale it maps the axis's Y
component onto, `(1 - x²)^0.5`, is zero there. surge's is the only exact
round trip of the three.

**Blink** is at or below surge on all eleven rows it can express, and every
byte of every difference is a length prefix:

| Row                  | Bytes saved | Length prefixes, u16 against u32                 |
| -------------------- | ----------- | ------------------------------------------------ |
| deeply nested object | 4           | two strings                                      |
| large record         | 402         | the map count and 200 key prefixes               |
| string-heavy         | 206         | two strings, the `lines` array, its 100 elements |
| tagged union         | 46          | the array count and 22 chat events' strings      |
| each remaining row   | 0 or 2      | none, or one                                     |

Nothing else in the catalog separates the two: Blink's `CFrame` is 24 bytes
like surge's, and inexact by the same 2e-7.

**Zap** matches Blink byte for byte on every row both express, except the
large record, where its map header is 3 bytes — a presence bit and a u16
count — against Blink's 2 and surge's 4. Its bit packing is per scope: the
booleans and optional presence of one struct share a mask, which is why its
packed `toggles` row is 14 bytes, surge's `Packed<T>` less that row's one
string prefix; but each array element is its own scope, so a thousand
booleans cost it 1002 bytes, as they cost surge and Blink.

**No row puts a value in any library's side table.** The catalog has no
`Instance`, `unknown`, or datatype that any library passes outside the
buffer.

## Discussion

The size table says the encodings are what they were designed to be. Where
surge and fbs disagree it is on purpose; where Blink and Zap are smaller it is
a default count width and nothing else; and where serio is smaller it is
quantization, paid for in precision.

Every byte Blink and Zap save is a width surge can now choose. `DataType.Length<T, L>`
narrows a container's count, so each of the rows in the Blink table can be
brought to the same size by a shape that declares the narrower count. The
fixtures here declare element widths only, and take surge's u32 default,
which is why the difference shows.

One result is an artifact of the runner, not of a library. Zap's `CFrame` row
is 1202 bytes, 24 per rotation like the others, but its decode comes back
scaled: Zap rebuilds a rotation by passing the unnormalized axis-angle vector
to `CFrame.fromAxisAngle`, and the Lune shim does not normalize it. Its real
reader does the same thing as the tooling decoder, so either the engine
normalizes or Zap's `CFrame` support is broken in production; surge and fbs
both pass `.Unit` and depend on neither. That was not established.

What this does not show: it measures one sample value per row, so a row whose
size depends on its data — the tagged union's string lengths, the guarded
union's mix of types — is one draw from its seed, not a distribution. It says
nothing about speed. And the serio errors of 0.01 to 0.7 on some elements of
the axis-aligned row, beyond the X-axis loss, have no mechanism recorded here.

## Conclusion

surge's bytes match fbs's wherever they are meant to, match serio's wherever
neither quantizes, and lose to Blink and Zap only by a count width that
`DataType.Length` now lets a shape choose. Its one size advantage is the
axis-aligned `Packed<T>` rotation, which is also the only exact one.

## Data

- `docs/benchmarks/size.md` as regenerated at the commit above, identical to
  the committed file; the recorder is `tests/scripts/lune-size-runner.luau`.
- The per-row descriptions and round-trip errors are in that file's table,
  and the fixtures that produce each row are under `tests/src/bench/`.

## Correction, 2026-09-23

This corrects two statements, both against `docs/benchmarks/size.md`.

- **What a thousand booleans cost surge.** Results, the Zap paragraph: "a thousand booleans cost
  it 1002 bytes, as they cost surge and Blink". On `Blink: Booleans`, surge writes 1004 bytes,
  against 1002 for Blink and Zap. The two extra bytes are surge's u32 array count. The statement
  should have said "as they cost Blink".
- **The packed arbitrary-rotation row.** Results: "The two they differ on are both `Packed<T>`
  rotations"; Discussion: "Where surge and fbs disagree it is on purpose". Only the axis-aligned
  row is explained. On `CFrame array (packed, arbitrary)`, surge writes 1254 bytes, against 1212
  for fbs and 919 for serio. This paper does not explain the 42 bytes surge writes beyond fbs, and
  does not establish that they are deliberate.
