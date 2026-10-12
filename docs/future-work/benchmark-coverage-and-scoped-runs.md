# Future work: benchmark coverage

Part of the [surge](../architecture.md) design. The harness is specified in
[specs/benchmark-harness.md](../specs/benchmark-harness.md).

## What

**Rows that open work in
[generated-code-performance.md](generated-code-performance.md) needs:**

- **A tuple with a rest element**: the rest's fixed-size elements reserve one
  at a time.
- **A `ColorSequence` or `NumberSequence`**: sizing one from its keypoint
  count.

**Rows for kinds no row covers:**

- **Optional-heavy:** an array of sparse updates, each with several optional
  fields of different kinds, such as a number, a string, a `Vector3` and a
  literal union. The toggles row's two optionals are the only ones measured,
  including by the two changes to optionals in
  [optional-length-once.md](../research/optional-length-once.md) and
  [empty-closure-and-dead-checks.md](../research/empty-closure-and-dead-checks.md).
- **Datatypes**, in three rows: an array of records of a `Vector2`, a
  `Color3` and a `UDim2`; a `Set`; and the `CFrame` array in the 18-byte
  `DataType.Quantized`.

## Why

The rows give the open items a cell to be measured on. Each addition makes a
full run longer; a scoped run (Benchmark harness 9) times only the cells a
change touches.

## Why deferred

It was found while reading the results of the `smaller-generated-code`
branch, and is harness work, not part of that branch. It comes before the
write-side speed work in
[write-state-and-joined-reservations.md](write-state-and-joined-reservations.md).
That way the papers measuring that work cite the larger catalog as their
baseline.

## Constraints

- **Coverage by column**, from the matrix in
  [type-coverage-across-libraries.md](../research/type-coverage-across-libraries.md):
    - Optionals: every column, Flamework 2's on the toggles row.
    - `Color3`: fbs, serio, Blink and Zap.
    - A tuple's rest: fbs. serio's rest is written as a `u16` and read as a
      `u32`; Blink has tuples only as event arguments; Zap has none.
    - Sequences: fbs and serio, each with its own encoding.
    - `Vector2`: Zap, which decodes it as a `Vector3`. fbs and serio pass it
      beside the bytes.
    - `UDim2`: serio.
    - `Set`: fbs, serio, Blink (a flag set of fixed members) and Zap.
    - A quantized `CFrame`: serio's default `CFrame` is 18 bytes, quantized.

    Flamework 2's support for the rest is not checked.

- **Catalog rules.** Benchmark harness 3.1 states the row count. A new row
  needs a Blink and a Zap definition (4.4) and a Flamework 2 module
  (4.10–4.11), or an empty cell where the library cannot express the shape
  (3.4).
- New rows add to surge's column in `code-size.md`, whose sum the papers
  cite, and change the summary in `speed.md`.

## Result

- The rows in the catalog, recorded in `size.md`, `code-size.md` and
  `speed.md`.
- Benchmark harness section 3 updated to match.

## Notes

- A row with a `DataType.Range` number or an exact `DataType.Length` would
  also give `writeChecks` code to generate. No row has either
  ([read-checks-cost.md](../research/read-checks-cost.md)).
