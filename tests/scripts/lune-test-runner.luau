-- Drives the compiled @rbxts/runit suites under Lune instead of Roblox Studio, by faking just
-- enough of the Roblox Instance surface (WaitForChild/GetService/Parent/GetDescendants/IsA) that
-- the roblox-ts output's `TS.import`/`require(Instance)` calls resolve to real files under out/,
-- node_modules/, and include/. See docs/testing.md's "Round-trip tests run under Lune" section
-- for the contract this participates in. Adapted from an existing solution to this same problem
-- in another project (this exact "Lune's require() has no Instance overload" limitation,
-- confirmed empirically before writing any of this).
--
-- Two Luau-level constraints shaped the design:
--  - Lune's fs functions yield internally, and Luau forbids yielding across a metamethod
--    boundary. So __index (used for `script.Parent.Promise`-style dot access by compiled code)
--    can never itself touch the filesystem -- every real directory is scanned eagerly, through
--    plain function calls, when its instance is constructed, so __index only ever does table
--    lookups afterward.
--  - Lune doesn't inject CFrame/Vector3/Color3/Enum/task/Instance as ambient globals the way
--    Roblox does; compiled code assumes they exist, so they're bound as globals below.
--
-- Roblox Studio (via the tests place's Rojo project) is still how benchmarks run -- benchmarks
-- need real timing and are meant to be read by a person, not scraped for a pass/fail sentinel.
-- This runner is for the round-trip correctness suite only.
local fs = require("@lune/fs")
local roblox = require("@lune/roblox")
local luneTask = require("@lune/task")

local realRequire = require

local Methods = {}
local FakeInstance = {}

local function classifyAndBuild(name, parent, realPath, isDir)
	local child = setmetatable({
		Name = name,
		ClassName = "Folder",
		_parent = parent,
		_realBase = nil,
		_filePath = nil,
		_children = {},
	}, FakeInstance)

	if isDir then
		child._realBase = realPath
		for _, initName in { "init.luau", "init.lua" } do
			local initPath = realPath .. "/" .. initName
			if fs.isFile(initPath) then
				child.ClassName = "ModuleScript"
				-- Requiring the directory itself, not the init file, lets Lune's own
				-- directory-to-init resolution run -- requiring "<dir>/init" explicitly is
				-- ambiguous to it.
				child._filePath = realPath
				break
			end
		end
	else
		child.ClassName = "ModuleScript"
		child._filePath = realPath
	end

	return child
end

local function scanDirectoryInto(instance)
	local realBase = rawget(instance, "_realBase")
	if not realBase then
		return
	end

	local entries = fs.readDir(realBase)
	local seen = {}

	for _, entry in entries do
		local fullPath = realBase .. "/" .. entry
		if fs.isFile(fullPath) then
			local name = entry:match("^(.*)%.luau?$")
			if name and not seen[name] then
				seen[name] = true
				instance._children[name] = classifyAndBuild(name, instance, fullPath, false)
			end
		elseif fs.isDir(fullPath) then
			if not seen[entry] then
				seen[entry] = true
				local child = classifyAndBuild(entry, instance, fullPath, true)
				instance._children[entry] = child
				scanDirectoryInto(child)
			end
		end
	end
end

-- A folder can simultaneously be requirable (when it has an init.lua/init.luau) and a container
-- of siblings, exactly like a real Roblox Folder-with-ModuleScript-children -- so this reuses
-- classifyAndBuild's init-detection for the instance itself, not just its children.
local function newFolder(name, parent, realBase)
	local inst = classifyAndBuild(name, parent, realBase, true)
	if realBase then
		scanDirectoryInto(inst)
	end
	return inst
end

local function newStub(name, className, parent, extraFields)
	local inst = { Name = name, ClassName = className, _parent = parent, _children = {} }
	if extraFields then
		for key, value in extraFields do
			inst[key] = value
		end
	end
	return setmetatable(inst, FakeInstance)
end

function Methods:WaitForChild(name)
	local child = self._children[name]
	if not child then
		error(("WaitForChild: no child '%s' under %s"):format(name, self.Name), 0)
	end
	return child
end

function Methods:FindFirstChild(name)
	return self._children[name]
end

function Methods:GetDescendants()
	local result = {}
	local function walk(instance)
		for _, child in instance._children do
			table.insert(result, child)
			walk(child)
		end
	end
	walk(self)
	return result
end

function Methods:IsA(className)
	return self.ClassName == className
end

-- Unrecognized services are auto-vivified as inert stubs rather than erroring, since the
-- dependency graph reaches for services we don't otherwise care about just by existing
-- (HttpService, SoundService, ...), not by being used for anything. Services real code depends
-- on for actual behavior get their own richer stub below instead.
function Methods:GetService(name)
	local existing = self._children[name]
	if existing then
		return existing
	end
	local stub = newStub(name, name, self, {})
	self._children[name] = stub
	return stub
end

FakeInstance.__index = function(self, key)
	local method = Methods[key]
	if method then
		return method
	end
	if key == "Parent" then
		return rawget(self, "_parent")
	end
	-- rawget so the fallback cannot re-enter __index: this is the only point where that
	-- recursion is possible.
	return (rawget(self, "_children") :: any)[key]
end

require = function(x)
	if type(x) == "table" and getmetatable(x) == FakeInstance then
		if not rawget(x, "_filePath") then
			error("cannot require a non-ModuleScript instance: " .. x.Name, 0)
		end

		local previousScript = script
		script = x

		-- _filePath is relative to tests/ (this script's fs.* calls run with tests/ as cwd, per
		-- the "test:run" npm script), but Lune's require() is relative to the FILE containing
		-- the call -- this file lives one level down, in scripts/, hence the extra ".." hop.
		local requirePath = (rawget(x, "_filePath") :: string):gsub("%.luau$", ""):gsub("%.lua$", "")
		requirePath = requirePath:gsub("^%.", "..", 1)

		local ok, result = pcall(realRequire, requirePath)
		script = previousScript

		if not ok then
			error("requiring " .. (rawget(x, "_filePath") :: string) .. " failed: " .. tostring(result), 0)
		end

		return result
	end

	return realRequire(x)
end

-- Mirrors default.project.json.
local gameRoot = newStub("game", "DataModel", nil)

local serverStorage = newStub("ServerStorage", "ServerStorage", gameRoot)
gameRoot._children.ServerStorage = serverStorage
local testsFolder = newFolder("tests", serverStorage, "./out")
serverStorage._children.tests = testsFolder

local replicatedStorage = newStub("ReplicatedStorage", "ReplicatedStorage", gameRoot)
gameRoot._children.ReplicatedStorage = replicatedStorage

local rbxtsInclude = newFolder("rbxts_include", replicatedStorage, "./include")
replicatedStorage._children.rbxts_include = rbxtsInclude

-- node_modules is an explicit synthetic Folder overlaid on top of rbxts_include (per
-- default.project.json), not a real subdirectory of include/.
local nodeModules = newStub("node_modules", "Folder", rbxtsInclude)
rbxtsInclude._children.node_modules = nodeModules

local rbxtsScope = newFolder("@rbxts", nodeModules, "./node_modules/@rbxts")
nodeModules._children["@rbxts"] = rbxtsScope
local flameworkScope = newFolder("@flamework", nodeModules, "./node_modules/@flamework")
nodeModules._children["@flamework"] = flameworkScope

-- Specific service behavior real code depends on (everything else is auto-vivified inert):
--  - @rbxts/services' lazy game:GetService(...) lookup (used by @flamework/core) resolves
--    through Methods:GetService above; RunService itself needs real methods because
--    RuntimeLib's TS.getModule and Flamework's @Service/@Controller decorators call them
--    directly, not just look the service up.
--  - IsRunning() false short-circuits RuntimeLib's getModule client-replication wait before
--    it touches game.Loaded.
--  - IsClient() false takes the same branch a live server does; IsServer() true is the
--    corresponding branch Flamework's @Service decorator checks at class-module load time.
--  - Heartbeat never fires. Nothing in the suites schedules through it.
local runService = newStub("RunService", "RunService", gameRoot, {
	IsRunning = function()
		return false
	end,
	IsClient = function()
		return false
	end,
	IsServer = function()
		return true
	end,
	IsStudio = function()
		return false
	end,
	Heartbeat = {
		Connect = function()
			return { Disconnect = function() end }
		end,
	},
})
gameRoot._children.RunService = runService

local players = newStub("Players", "Players", gameRoot, { LocalPlayer = nil })
gameRoot._children.Players = players

-- Casts because Lune 0.10.5's @lune/roblox type definitions omit these datatype constructors
-- even though they exist at runtime. Extend this same pattern (`(roblox :: any).SomeType`) if a
-- future fixture needs a datatype not listed here (e.g. UDim2).
CFrame = (roblox :: any).CFrame
Vector3 = (roblox :: any).Vector3
Vector2 = (roblox :: any).Vector2
Vector3int16 = (roblox :: any).Vector3int16
Color3 = (roblox :: any).Color3
ColorSequence = (roblox :: any).ColorSequence
ColorSequenceKeypoint = (roblox :: any).ColorSequenceKeypoint
NumberSequence = (roblox :: any).NumberSequence
NumberSequenceKeypoint = (roblox :: any).NumberSequenceKeypoint
Enum = (roblox :: any).Enum
task = luneTask

-- @rbxts/signal (a hand-written, non-roblox-ts package @flamework/core's `Modding` module
-- constructs at module load, via `Signal.new()`) builds a real Instance.new("BindableEvent").
-- Lune's own Instance.new only builds data-model instances with no live event dispatch, so
-- BindableEvent needs an actually-functional stand-in -- Flamework's decorator/reflection
-- registration depends on it firing for real, not just existing. Every other class is a
-- data-model instance from Lune, which is enough for a fixture that passes an `Instance` through
-- the blob channel.
Instance = {
	new = function(className)
		if className == "BindableEvent" then
			local callbacks = {}
			local function connect(_, callback)
				table.insert(callbacks, callback)
				return { Disconnect = function() end }
			end
			return {
				ClassName = "BindableEvent",
				Event = { Connect = connect, Once = connect, ConnectParallel = connect },
				Fire = function(_, ...)
					for _, callback in callbacks do
						callback(...)
					end
				end,
				Destroy = function() end,
			}
		end
		return (roblox :: any).Instance.new(className)
	end,
}

game = gameRoot
script = testsFolder

-- Reuses src/index.ts's own TestRunner wiring and RUNIT_RESULT reporter rather than
-- reimplementing them here, so the sentinel contract has one implementation.
require(testsFolder).main()
