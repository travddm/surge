# Future work: automated benchmark CI

Part of the [surge](../architecture.md) design.

## What

Running the speed tier of the benchmark harness
(`tests/src/bench/speed.spec.ts`) automatically on every push, with
results recorded and diffed against a prior baseline — instead of a human
triggering a run and recording numbers by hand. The size tier needs
nothing here: it runs under Lune and writes `docs/benchmarks/size.md`
itself (section 5 of
[specs/benchmark-harness.md](../specs/benchmark-harness.md)).

## Why deferred

The round-trip correctness suite (`tests/src/tests/`) already runs
headlessly, on every push, via a Lune-based test runner (see "Round-trip
tests run under Lune" in [testing.md](../testing.md)). The speed
tier can now also run without a human clicking Play — `run-in-roblox`
drives a real Roblox Studio process for it (`mise run bench:speed`;
section 6 of [specs/benchmark-harness.md](../specs/benchmark-harness.md))
— but that only means a single run is automatable, not that it belongs in
CI: a benchmark run has no pass/fail signal to gate on, only numbers, and
turning those numbers into a tracked, diffed baseline (deciding what
counts as a regression, where the baseline lives, how noisy a single-VM
timing run is run-to-run) is a separate, larger design decision than
`run-in-roblox` working at all — not something this design should take on
as an assumed dependency. Consequence: speed numbers recorded for
this project are only as current as the last person who actually ran
`mise run bench:speed` (or Studio) and wrote them down.

## How, briefly

`run-in-roblox` is confirmed to work for this project, empirically: it
runs `tests/scripts/run-in-roblox-benchmarks.luau` as its own Script
instance without simulating Play (so `MainServer`/`MainBenchmarks` never
fire on their own), loads a place depending on `@flamework/core`/
`rbxts-transformer-flamework` (the same dependency `@rbxts/runit` itself
has) without issue, and exits on its own once the script finishes — no
interaction needed. What's still unevaluated, if this is ever pursued:
whether it needs a visible Studio window on the machine that would run it
in CI (unconfirmed either way — it did not require interacting with one
locally), where recorded numbers would live (a checked-in file, as
`mise run bench:speed` writes `benchmarks/speed.md` by hand today, or
something queryable), and what makes a timing difference across
runs a real regression rather than ordinary noise. Worth its own decision
if ever pursued, not assumed here.
