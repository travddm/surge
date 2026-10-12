# Future work: benchmark coverage, and runs scoped to a change

Part of the [surge](../architecture.md) design. The harness is specified in
[specs/benchmark-harness.md](../specs/benchmark-harness.md).

## What

**A `surge (readChecks)` column, decode only.** The same declaration as each
row's surge cell, through `createCodec<T>({ readChecks: true })`.
[getting-started.md](../getting-started.md) and
[errors-and-guarantees.md](../errors-and-guarantees.md) tell every server to
read what a client sent this way. Flamework 2's `deserialize` checks its input
on every call, so this column, not surge's unchecked one, is the like-for-like
decode comparison. The column has been measured once, at surge `c295e5b`
([read-checks-cost.md](../research/read-checks-cost.md)), and then removed
(Benchmark harness, Changes). Encode runs the same code with and without the
option, so the column has no encode cell.

**Rows that open work in
[generated-code-performance.md](generated-code-performance.md) needs:**

- **A cursor codec**, through `createCursorCodec<T>`: the form that checks the
  room for a shape sized exactly once, and what writing into a buffer the
  caller reuses is worth against `serialize`. No other column has a cursor
  API, so this may be a column on the rows sized exactly rather than a row.
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
- **Datatypes:** `Vector2`, `Color3`, `UDim2`, a `Set`, and the 18-byte
  `DataType.Quantized` `CFrame`.

**Runs scoped to a change.** A full speed invocation is two runs of 204
cells. A cell takes at least 1.9 s a run whatever its library (a 0.1 s
warm-up and nine trials of at least 0.2 s, Benchmark harness 6.2 and 6.3), so
an invocation takes about fourteen minutes, and the rows above add to it. A
measurement of a change needs only these cells:

- the rows whose surge code the change touches: those whose compiled module
  under `tests/out/bench/codecs/` differs between the reference build and
  the change's, and those whose module calls a runtime function the change
  touches;
- the halves the change touches;
- surge, the baseline where the row has one, and the controls below.

Scoped runs (Benchmark harness 9) select rows only, run once, and write no
trials file, so a paper cannot be read from one.

## Why

The rows give the open items a cell to be measured on, and the column prices
what the documentation recommends for every server. Each addition makes every
run longer. Each change in the next step needs a reference invocation and a
change invocation of its own, and the scoped run keeps both short.
[testing.md](../testing.md#benchmarks) requires scoped runs wherever they can
measure a change. Until a scoped run writes its trials, a paper still needs
full runs.

## Why deferred

It was found while reading the results of the `smaller-generated-code`
branch, and is harness work, not part of that branch. It comes before the
write-side speed work in
[write-state-and-joined-reservations.md](write-state-and-joined-reservations.md).
That way the papers measuring that work cite the larger catalog as their
baseline and are measured with scoped runs.

## Constraints

- **Controls.** A measurement reads a change against the drift of the row's
  quiet control cells, and reads how far unchanged code moves as each control
  against its row's other controls
  ([noise-in-the-speed-tier.md](../research/noise-in-the-speed-tier.md)). The
  baseline covers 10 of the 21 rows, and none of the four that the write-state
  change touches. A scoped run must keep at least two control columns on each
  row it selects, or read the drift over all the selected rows' controls
  together, with the method written down before it is used.
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
- **Published tables.** `docs/benchmarks/speed.md` stays a full run: a
  scoped run feeds a paper and writes nowhere under `docs/benchmarks/`.
- New rows change the totals in `code-size.md` and the summary in `speed.md`.

## Result

- The column and the rows in the catalog, recorded in `size.md`,
  `code-size.md` and `speed.md`.
- A scoped speed run that:
    - selects rows, columns and halves;
    - keeps the controls above;
    - runs twice;
    - writes its trials where a paper's analysis can read them.
- Benchmark harness sections 3, 4 and 9 updated to match.

## Notes

- The checked column's first form was Benchmark harness 4.9, driven by
  surge's adapter. Whether it gets a code-size cell is open: it would add a
  checked module per fixture.
- A row with a `DataType.Range` number or an exact `DataType.Length` would
  also give `writeChecks` code to generate. No row has either
  ([read-checks-cost.md](../research/read-checks-cost.md)).
- The first scoped measurement is likely the write-state change: four rows,
  encode only.
    - Each row has fbs and serio as controls.
    - Flamework 2 and Blink cover two of the rows.
    - With every control kept, that is 16 cells a run, against 204.
