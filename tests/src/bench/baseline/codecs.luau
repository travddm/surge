--!native
--!optimize 2
-- The hand-written baseline of section 4.5 of docs/specs/benchmark-harness.md:
-- what a person would write by hand for one fixed shape, with no transformer, no schema, and no
-- library in the way. It is not a comparison with anything published. It is the floor -- the
-- fewest instructions the shape structurally needs -- so the gap between it and surge's emitted
-- code is the overhead surge adds rather than the cost of the format.
--
-- Written in Luau rather than TypeScript on purpose: the question is what the Luau looks like, so
-- roblox-ts's own idioms (its `for` loops, its temporaries) have no business being in the answer.
-- codecs.d.ts declares it for the fixtures that import it.
--
-- Each codec writes the bytes surge writes, field for field, so the size table is the check that
-- the two are comparable: a baseline row that does not equal surge's is measuring a different
-- format and its timing means nothing. Field order is surge's, which sorts by name; see Wire
-- format 5.1 in docs/specs/wire-format.md.
--
-- Both directives, like every benchmark fixture: the fixtures are where surge's generated code
-- lives, and marking this codec the same way keeps the distance between the two columns a fact
-- about code rather than about compilation mode. What the directives are worth on the generated
-- code is in docs/research/file-directives-on-generated-code.md.

local function writeSmallFlatStruct(value)
	-- One allocation, because every field of this shape is fixed width.
	local buf = buffer.create(17)
	buffer.writeu8(buf, 0, if value.active then 1 else 0)
	buffer.writeu32(buf, 1, value.id)
	buffer.writef32(buf, 5, value.x)
	buffer.writef32(buf, 9, value.y)
	buffer.writef32(buf, 13, value.z)
	return buf
end

local function readSmallFlatStruct(buf)
	return {
		active = buffer.readu8(buf, 0) ~= 0,
		id = buffer.readu32(buf, 1),
		x = buffer.readf32(buf, 5),
		y = buffer.readf32(buf, 9),
		z = buffer.readf32(buf, 13),
	}
end

local function writeNestedObject(value)
	local root = value.root
	local second = root.inner
	local third = second.inner
	local leaf = third.leaf
	local name, label = leaf.name, root.label

	-- 16 fixed bytes: a u16, two u8, an f32, and a u32 length for each of the two strings.
	local buf = buffer.create(16 + #name + #label)
	buffer.writeu16(buf, 0, second.count)
	buffer.writeu8(buf, 2, if third.flag then 1 else 0)
	buffer.writeu32(buf, 3, #name)
	buffer.writestring(buf, 7, name)

	local offset = 7 + #name
	buffer.writef32(buf, offset, leaf.weight)
	buffer.writeu32(buf, offset + 4, #label)
	buffer.writestring(buf, offset + 8, label)
	buffer.writeu8(buf, offset + 8 + #label, value.version)
	return buf
end

local function readNestedObject(buf)
	local count = buffer.readu16(buf, 0)
	local flag = buffer.readu8(buf, 2) ~= 0
	local nameLength = buffer.readu32(buf, 3)
	local name = buffer.readstring(buf, 7, nameLength)

	local offset = 7 + nameLength
	local weight = buffer.readf32(buf, offset)
	local labelLength = buffer.readu32(buf, offset + 4)
	local label = buffer.readstring(buf, offset + 8, labelLength)
	local version = buffer.readu8(buf, offset + 8 + labelLength)

	return {
		root = {
			inner = { inner = { leaf = { name = name, weight = weight }, flag = flag }, count = count },
			label = label,
		},
		version = version,
	}
end

local CFRAME_BYTES = 24

local function writeTransforms(value)
	local list = value.list
	local count = #list
	local buf = buffer.create(4 + count * CFRAME_BYTES)
	buffer.writeu32(buf, 0, count)

	local offset = 4
	for index = 1, count do
		local cframe = list[index]
		local position = cframe.Position
		buffer.writef32(buf, offset, position.X)
		buffer.writef32(buf, offset + 4, position.Y)
		buffer.writef32(buf, offset + 8, position.Z)

		-- The axis scaled by the angle, which is surge's rotation: one f32 triple, no header.
		local axis, angle = cframe:ToAxisAngle()
		local scaled = axis * angle
		buffer.writef32(buf, offset + 12, scaled.X)
		buffer.writef32(buf, offset + 16, scaled.Y)
		buffer.writef32(buf, offset + 20, scaled.Z)
		offset += CFRAME_BYTES
	end
	return buf
end

local function readTransforms(buf)
	local count = buffer.readu32(buf, 0)
	-- Sized up front: the count is on the wire, so a person writing this by hand would use it. surge's
	-- reader does the same (Transformer 5.21 in docs/specs/transformer.md).
	local list = table.create(count)

	local offset = 4
	for index = 1, count do
		local position =
			Vector3.new(buffer.readf32(buf, offset), buffer.readf32(buf, offset + 4), buffer.readf32(buf, offset + 8))
		local scaled = Vector3.new(
			buffer.readf32(buf, offset + 12),
			buffer.readf32(buf, offset + 16),
			buffer.readf32(buf, offset + 20)
		)
		local angle = scaled.Magnitude
		-- surge's rule, which this has to match to decode what it wrote: a zero rotation leaves no
		-- axis to recover, so the axis is arbitrary.
		list[index] = CFrame.fromAxisAngle(if angle > 1e-6 then scaled.Unit else Vector3.zAxis, angle) + position
		offset += CFRAME_BYTES
	end
	return { list = list }
end

-- Variants are numbered by tag value (chat, damage, despawn, spawn) and each writes its fields by
-- name, as surge does. The buffer is sized in a first pass over the events so that it is created
-- once, at its size: without a buffer that grows, a shape whose size varies needs that pass. Both
-- passes use a generic `for`, which measured faster than a numeric one over an array in surge's
-- own code (docs/research/per-element-encode.md).
local function writeTaggedUnion(value)
	local events = value.events
	local count = #events
	-- The count, and one variant byte per event.
	local size = 4 + count
	for _, event in events do
		local kind = event.kind
		if kind == "chat" then
			size += 8 + #event.text
		elseif kind == "damage" then
			size += 6
		elseif kind == "despawn" then
			size += 4
		else
			size += 16
		end
	end

	local buf = buffer.create(size)
	buffer.writeu32(buf, 0, count)
	local offset = 4
	for _, event in events do
		local kind = event.kind
		if kind == "chat" then
			local text = event.text
			local length = #text
			buffer.writeu8(buf, offset, 0)
			buffer.writeu32(buf, offset + 1, event.id)
			buffer.writeu32(buf, offset + 5, length)
			buffer.writestring(buf, offset + 9, text)
			offset += 9 + length
		elseif kind == "damage" then
			buffer.writeu8(buf, offset, 1)
			buffer.writeu16(buf, offset + 1, event.amount)
			buffer.writeu32(buf, offset + 3, event.id)
			offset += 7
		elseif kind == "despawn" then
			buffer.writeu8(buf, offset, 2)
			buffer.writeu32(buf, offset + 1, event.id)
			offset += 5
		else
			local at = event.at
			buffer.writeu8(buf, offset, 3)
			buffer.writef32(buf, offset + 1, at.X)
			buffer.writef32(buf, offset + 5, at.Y)
			buffer.writef32(buf, offset + 9, at.Z)
			buffer.writeu32(buf, offset + 13, event.id)
			offset += 17
		end
	end
	return buf
end

local function readTaggedUnion(buf)
	local count = buffer.readu32(buf, 0)
	local events = table.create(count)

	local offset = 4
	for index = 1, count do
		local variant = buffer.readu8(buf, offset)
		if variant == 0 then
			local length = buffer.readu32(buf, offset + 5)
			events[index] = {
				kind = "chat",
				id = buffer.readu32(buf, offset + 1),
				text = buffer.readstring(buf, offset + 9, length),
			}
			offset += 9 + length
		elseif variant == 1 then
			events[index] = {
				kind = "damage",
				amount = buffer.readu16(buf, offset + 1),
				id = buffer.readu32(buf, offset + 3),
			}
			offset += 7
		elseif variant == 2 then
			events[index] = { kind = "despawn", id = buffer.readu32(buf, offset + 1) }
			offset += 5
		else
			events[index] = {
				kind = "spawn",
				at = Vector3.new(
					buffer.readf32(buf, offset + 1),
					buffer.readf32(buf, offset + 5),
					buffer.readf32(buf, offset + 9)
				),
				id = buffer.readu32(buf, offset + 13),
			}
			offset += 17
		end
	end
	return { events = events }
end

-- `Packed<T>`'s bit region: the ten booleans, then the presence of `label` and of `offset`, one bit
-- each from the low bit of the first byte. The fields that are not bits follow it by name.
local function writePackedToggles(value)
	local label, offsetField = value.label, value.offset
	-- The two bytes of bits, and `level`.
	local size = 3
	if label ~= nil then
		size += 4 + #label
	end
	if offsetField ~= nil then
		size += 2
	end

	local buf = buffer.create(size)
	buffer.writeu8(
		buf,
		0,
		(if value.a then 1 else 0)
			+ (if value.b then 2 else 0)
			+ (if value.c then 4 else 0)
			+ (if value.d then 8 else 0)
			+ (if value.e then 16 else 0)
			+ (if value.f then 32 else 0)
			+ (if value.g then 64 else 0)
			+ (if value.h then 128 else 0)
	)
	buffer.writeu8(
		buf,
		1,
		(if value.i then 1 else 0)
			+ (if value.j then 2 else 0)
			+ (if label ~= nil then 4 else 0)
			+ (if offsetField ~= nil then 8 else 0)
	)

	local offset = 2
	if label ~= nil then
		local length = #label
		buffer.writeu32(buf, offset, length)
		buffer.writestring(buf, offset + 4, label)
		offset += 4 + length
	end
	buffer.writeu8(buf, offset, value.level)
	if offsetField ~= nil then
		buffer.writei16(buf, offset + 1, offsetField)
	end
	return buf
end

-- Each byte of bits is read once and tested in place.
local function readPackedToggles(buf)
	local low = buffer.readu8(buf, 0)
	local high = buffer.readu8(buf, 1)

	local offset = 2
	local label
	if bit32.btest(high, 4) then
		local length = buffer.readu32(buf, offset)
		label = buffer.readstring(buf, offset + 4, length)
		offset += 4 + length
	end
	local level = buffer.readu8(buf, offset)
	local offsetField
	if bit32.btest(high, 8) then
		offsetField = buffer.readi16(buf, offset + 1)
	end

	return {
		a = bit32.btest(low, 1),
		b = bit32.btest(low, 2),
		c = bit32.btest(low, 4),
		d = bit32.btest(low, 8),
		e = bit32.btest(low, 16),
		f = bit32.btest(low, 32),
		g = bit32.btest(low, 64),
		h = bit32.btest(low, 128),
		i = bit32.btest(high, 1),
		j = bit32.btest(high, 2),
		label = label,
		level = level,
		offset = offsetField,
	}
end

-- Each entry's u16 in order after the count, and its Instance in the blob list at the same
-- index: surge's order, since `health` sorts before `model` and an Instance writes no bytes.
local function writeLeaderboard(value)
	local entries = value.entries
	local count = #entries
	-- The count, and each entry's name length, score and user id.
	local size = 4 + 16 * count
	for _, entry in entries do
		size += #entry.name
	end

	local buf = buffer.create(size)
	buffer.writeu32(buf, 0, count)
	local offset = 4
	for _, entry in entries do
		local name = entry.name
		local length = #name
		buffer.writeu32(buf, offset, length)
		buffer.writestring(buf, offset + 4, name)
		offset += 4 + length
		buffer.writeu32(buf, offset, entry.score)
		buffer.writef64(buf, offset + 4, entry.userId)
		offset += 12
	end
	return buf
end

local function readLeaderboard(buf)
	local count = buffer.readu32(buf, 0)
	local entries = table.create(count)
	local offset = 4
	for index = 1, count do
		local length = buffer.readu32(buf, offset)
		local name = buffer.readstring(buf, offset + 4, length)
		offset += 4 + length
		entries[index] = {
			name = name,
			score = buffer.readu32(buf, offset),
			userId = buffer.readf64(buf, offset + 4),
		}
		offset += 12
	end
	return { entries = entries }
end

-- One pass to count the nodes, so the buffer is created once at its size: every node is a
-- u32 child count and a u16 id.
local function countTreeNodes(node)
	local count = 1
	for _, child in node.children do
		count += countTreeNodes(child)
	end
	return count
end

local function writeTreeNode(buf, offset, node)
	local children = node.children
	buffer.writeu32(buf, offset, #children)
	offset += 4
	for _, child in children do
		offset = writeTreeNode(buf, offset, child)
	end
	buffer.writeu16(buf, offset, node.id)
	return offset + 2
end

local function writeTree(value)
	local buf = buffer.create(6 * countTreeNodes(value))
	writeTreeNode(buf, 0, value)
	return buf
end

local function readTreeNode(buf, offset)
	local count = buffer.readu32(buf, offset)
	offset += 4
	local children = table.create(count)
	for index = 1, count do
		children[index], offset = readTreeNode(buf, offset)
	end
	return { children = children, id = buffer.readu16(buf, offset) }, offset + 2
end

local function readTree(buf)
	return (readTreeNode(buf, 0))
end

local function writeInstanceRefs(value)
	local entries = value.entries
	local count = #entries
	local buf = buffer.create(4 + 2 * count)
	local blobs = table.create(count)
	buffer.writeu32(buf, 0, count)
	for index, entry in entries do
		buffer.writeu16(buf, 2 + 2 * index, entry.health)
		blobs[index] = entry.model
	end
	return { buffer = buf, blobs = blobs }
end

local function readInstanceRefs(payload)
	local buf = payload.buffer
	local blobs = payload.blobs
	local count = buffer.readu32(buf, 0)
	local entries = table.create(count)
	for index = 1, count do
		entries[index] = { health = buffer.readu16(buf, 2 + 2 * index), model = blobs[index] }
	end
	return { entries = entries }
end

return {
	smallFlatStruct = { write = writeSmallFlatStruct, read = readSmallFlatStruct },
	nestedObject = { write = writeNestedObject, read = readNestedObject },
	transforms = { write = writeTransforms, read = readTransforms },
	taggedUnion = { write = writeTaggedUnion, read = readTaggedUnion },
	packedToggles = { write = writePackedToggles, read = readPackedToggles },
	leaderboard = { write = writeLeaderboard, read = readLeaderboard },
	tree = { write = writeTree, read = readTree },
	instanceRefs = { write = writeInstanceRefs, read = readInstanceRefs },
}
