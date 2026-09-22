-- Runs the speed suite (Tier 2 of docs/future-work/benchmark-tooling.md, see also the
-- Benchmarking strategy in docs/testing.md) inside a real Roblox Studio process driven by
-- `run-in-roblox`, via `mise run bench:speed`. The size tier needs no Roblox process and runs
-- under Lune instead, through scripts/lune-size-runner.luau. Confirmed empirically
-- that `run-in-roblox --script` runs this file as its own Script instance without simulating Play
-- -- `script` here is real (not nil, unlike the Studio command bar) and `MainServer`/
-- `MainBenchmarks` (see default.project.json) never fire on their own, so this is the only thing
-- that runs. Reuses src/index.ts's own `runBenchmarks()` (the same function the disabled
-- `MainBenchmarks` Script calls for a manual Play-based run) rather than reimplementing it here.
local tests = game:GetService("ServerStorage"):WaitForChild("tests")
require(tests).runBenchmarks()
