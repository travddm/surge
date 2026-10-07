-- Second run of the native-code-limits research. Requires each probe module, with markers, so
-- Studio's native code generation messages for a module land between its markers. Then times the
-- first and the last serializer of each mixed module on one sample value: a serializer that stays
-- interpreted runs slower than the same code compiled natively.
local probe = game:GetService("ServerStorage"):WaitForChild("tests"):WaitForChild("probe")
local modules = probe:GetChildren()
table.sort(modules, function(a, b)
	return a.Name < b.Name
end)

local loaded = {}
for _, module in modules do
	if module:IsA("ModuleScript") then
		print("PROBE_BEGIN " .. module.Name)
		local ok, result = pcall(require, module)
		print(("PROBE_END %s %s"):format(module.Name, if ok then "ok" else tostring(result)))
		if ok then
			loaded[module.Name] = result
		end
	end
end

-- One value of the 100-property mixed object: the six kinds in turn, as gen2.py declares them.
local mixed = {}
for i = 0, 99 do
	local kind = i % 6
	local name = "m" .. i
	if kind == 0 then
		mixed[name] = "text " .. i
	elseif kind == 1 then
		mixed[name] = Vector3.new(i, i + 1, i + 2)
	elseif kind == 2 then
		mixed[name] = CFrame.new(i, i + 1, i + 2) * CFrame.Angles(0.1, 0.2, 0.3)
	elseif kind == 3 then
		mixed[name] = i
	elseif kind == 4 then
		mixed[name] = i % 2 == 0
	else
		mixed[name] = "maybe " .. i
	end
end

local CALLS = 2000
local TRIALS = 7
-- The median time of one call to `fn`, in microseconds, over TRIALS batches of CALLS calls.
local function median(fn)
	local times = {}
	for _ = 1, TRIALS do
		local start = os.clock()
		for _ = 1, CALLS do
			fn()
		end
		table.insert(times, (os.clock() - start) / CALLS * 1e6)
		task.wait()
	end
	table.sort(times)
	return times[(TRIALS + 1) // 2]
end

local names = {}
for name in loaded do
	if name:match("^module_") then
		table.insert(names, name)
	end
end
table.sort(names)
for _, name in names do
	local exports = loaded[name]
	local count = 0
	while exports["codec" .. count] do
		count += 1
	end
	for _, index in { 0, count - 1 } do
		local codec = exports["codec" .. index]
		local buf = codec.serialize(mixed)
		local encode = median(function()
			codec.serialize(mixed)
		end)
		local decode = median(function()
			codec.deserialize(buf)
		end)
		print(("PROBE_TIME %s codec%d encode=%.3fus decode=%.3fus"):format(name, index, encode, decode))
	end
end
print("PROBE_DONE")
