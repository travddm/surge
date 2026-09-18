-- Runs the benchmark suite (see docs/testing.md's Benchmarking strategy) inside a real Roblox
-- Studio process driven by `run-in-roblox`, via `mise run tests:benchmark`. Confirmed empirically
-- that `run-in-roblox --script` runs this file as its own Script instance without simulating Play
-- -- `script` here is real (not nil, unlike the Studio command bar) and `MainServer`/
-- `MainBenchmarks` (see default.project.json) never fire on their own, so this is the only thing
-- that runs. Reuses src/index.ts's own `runBenchmarks()` (the same function the disabled
-- `MainBenchmarks` Script calls for a manual Play-based run) rather than reimplementing it here.
local tests = game:GetService("ServerStorage"):WaitForChild("tests")
require(tests).runBenchmarks()
