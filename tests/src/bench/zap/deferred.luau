-- Loads the generated Zap server module next to this file, on first call rather than at require.
--
-- That module errors at require time when RunService:IsClient() is true, and Studio's edit mode --
-- where `mise run bench:speed` runs the catalog through run-in-roblox -- answers true to both
-- IsClient and IsServer. Zap is a size-only column, measured only under Lune (see
-- docs/future-work/benchmark-tooling.md), so nothing in a Roblox process ever needs the module:
-- deferring the require is what keeps every fixture that names a Zap event loadable there.
--
-- The folder is read at load, not at call: scripts/lune-roblox-shim.luau swaps the global `script`
-- around each require, so by the time the returned function runs it names some other module.
local folder = script.Parent
local server = nil

return function()
	if server == nil then
		server = require(folder.server)
	end
	return server
end
