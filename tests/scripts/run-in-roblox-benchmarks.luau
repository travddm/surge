-- Runs the speed suite (Tier 2 of docs/future-work/benchmark-tooling.md, see also the
-- Benchmarking strategy in docs/testing.md) inside a real Roblox Studio process driven by
-- `run-in-roblox`, via `mise run bench:speed`. The size tier needs no Roblox process and runs
-- under Lune instead, through scripts/lune-size-runner.luau. Confirmed empirically
-- that `run-in-roblox --script` runs this file as its own Script instance without simulating Play
-- -- `script` here is real (not nil, unlike the Studio command bar) and `MainServer`/
-- `MainBenchmarks` (see default.project.json) never fire on their own, so this is the only thing
-- that runs. Reuses src/index.ts's own `runBenchmarks()` (the same function the disabled
-- `MainBenchmarks` Script calls for a manual Play-based run) rather than reimplementing it here.
-- `run-in-roblox` calls this file on its plugin's own thread and ends the run when it returns, so
-- `runBenchmarks()` does not return until the verdict is printed; it waits by yielding, which is
-- what keeps Studio from raising its "plugin has stopped responding" prompt over the run.
--
-- `run-in-roblox` passes no arguments into the Studio process, so this file is the only channel a
-- scoped run (`mise run bench:speed:only`) has: scripts/record-speed-benchmarks.mjs copies this
-- file into dist/ with the fixture patterns substituted into the line below, and points
-- `--script` at the copy. An empty list measures the whole catalog. Keep that line on one line
-- and exactly as written -- the recorder matches it verbatim and stops when it does not find it,
-- rather than running the full catalog under a name that says otherwise.
local fixtures = {}
local tests = game:GetService("ServerStorage"):WaitForChild("tests")
require(tests).runBenchmarks(fixtures)
