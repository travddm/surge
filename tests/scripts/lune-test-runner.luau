-- Drives the compiled @rbxts/runit round-trip suites under Lune instead of Roblox Studio, via
-- `mise run tests:test`. The fake Instance surface those suites load through lives in
-- lune-roblox-shim.luau, next to this file. See docs/testing.md's "Round-trip tests run under
-- Lune" section for the contract this participates in.
--
-- Reuses src/index.ts's own TestRunner wiring and RUNIT_RESULT reporter rather than
-- reimplementing them here, so the sentinel contract has one implementation.
local shim = require("./lune-roblox-shim")

shim.requireInstance(shim.tests).main()
