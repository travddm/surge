-- Feasibility run for the native-code-limits research: requires each probe module under
-- ServerStorage.tests.probe in turn, so native code generation compiles it, and prints a marker
-- around each require, so whatever Studio prints while compiling one lands between its markers.
-- Then asks for debug.dumpcodesize(), whose output format is undocumented.
local probe = game:GetService("ServerStorage"):WaitForChild("tests"):WaitForChild("probe")
local modules = probe:GetChildren()
table.sort(modules, function(a, b)
	return a.Name < b.Name
end)
for _, module in modules do
	if module:IsA("ModuleScript") then
		print("PROBE_BEGIN " .. module.Name)
		local ok, result = pcall(require, module)
		print(("PROBE_END %s %s"):format(module.Name, if ok then "ok" else tostring(result)))
	end
end
print("PROBE_DUMP_BEGIN")
local ok, err = pcall(debug.dumpcodesize)
print("PROBE_DUMP_END " .. (if ok then "ok" else tostring(err)))
