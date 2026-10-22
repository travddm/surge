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
--
-- Every count is surge's variable-length one (Wire format 6.9): one byte below 254, or the marker
-- 254 and a u16, or 255 and a u32. Each codec writes and reads the one-byte case inline, as
-- surge's generated code does, and the long forms through these two, which only a count of 254
-- or more reaches.

local function writeLongCount(buf, offset, count)
	if count <= 65535 then
		buffer.writeu8(buf, offset, 254)
		buffer.writeu16(buf, offset + 1, count)
	else
		buffer.writeu8(buf, offset, 255)
		buffer.writeu32(buf, offset + 1, count)
	end
end

-- The count whose marker is at `offset`, and the offset after it.
local function readLongCount(buf, offset, marker)
	if marker == 254 then
		return buffer.readu16(buf, offset + 1), offset + 3
	end
	return buffer.readu32(buf, offset + 1), offset + 5
end

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
	local nameLength, labelLength = #name, #label
	local nameHead = if nameLength < 254 then 1 elseif nameLength <= 65535 then 3 else 5
	local labelHead = if labelLength < 254 then 1 elseif labelLength <= 65535 then 3 else 5

	-- 8 fixed bytes: a u16, two u8 and an f32. Then each string's count and bytes.
	local buf = buffer.create(8 + nameHead + nameLength + labelHead + labelLength)
	buffer.writeu16(buf, 0, second.count)
	buffer.writeu8(buf, 2, if third.flag then 1 else 0)
	if nameLength < 254 then
		buffer.writeu8(buf, 3, nameLength)
	else
		writeLongCount(buf, 3, nameLength)
	end
	local offset = 3 + nameHead
	buffer.writestring(buf, offset, name)
	offset += nameLength
	buffer.writef32(buf, offset, leaf.weight)
	offset += 4
	if labelLength < 254 then
		buffer.writeu8(buf, offset, labelLength)
	else
		writeLongCount(buf, offset, labelLength)
	end
	offset += labelHead
	buffer.writestring(buf, offset, label)
	buffer.writeu8(buf, offset + labelLength, value.version)
	return buf
end

local function readNestedObject(buf)
	local count = buffer.readu16(buf, 0)
	local flag = buffer.readu8(buf, 2) ~= 0
	local nameLength = buffer.readu8(buf, 3)
	local offset = 4
	if nameLength >= 254 then
		nameLength, offset = readLongCount(buf, 3, nameLength)
	end
	local name = buffer.readstring(buf, offset, nameLength)
	offset += nameLength

	local weight = buffer.readf32(buf, offset)
	local labelLength = buffer.readu8(buf, offset + 4)
	if labelLength >= 254 then
		labelLength, offset = readLongCount(buf, offset + 4, labelLength)
	else
		offset += 5
	end
	local label = buffer.readstring(buf, offset, labelLength)
	local version = buffer.readu8(buf, offset + labelLength)

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
	local head = if count < 254 then 1 elseif count <= 65535 then 3 else 5
	local buf = buffer.create(head + count * CFRAME_BYTES)
	if count < 254 then
		buffer.writeu8(buf, 0, count)
	else
		writeLongCount(buf, 0, count)
	end

	local offset = head
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
	local count = buffer.readu8(buf, 0)
	local offset = 1
	if count >= 254 then
		count, offset = readLongCount(buf, 0, count)
	end
	-- Sized up front: the count is on the wire, so a person writing this by hand would use it. surge's
	-- reader does the same (Transformer 5.21 in docs/specs/transformer.md).
	local list = table.create(count)

	for index = 1, count do
		local x = buffer.readf32(buf, offset + 12)
		local y = buffer.readf32(buf, offset + 16)
		local z = buffer.readf32(buf, offset + 20)
		-- The axis scaled by the angle becomes a unit quaternion, so that one constructor builds the
		-- CFrame. sin(angle / 2) / angle tends to 1/2 as the angle tends to 0.
		local angle = math.sqrt(x * x + y * y + z * z)
		local scale = if angle > 1e-6 then math.sin(angle * 0.5) / angle else 0.5
		list[index] = CFrame.new(
			buffer.readf32(buf, offset),
			buffer.readf32(buf, offset + 4),
			buffer.readf32(buf, offset + 8),
			x * scale,
			y * scale,
			z * scale,
			math.cos(angle * 0.5)
		)
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
	local head = if count < 254 then 1 elseif count <= 65535 then 3 else 5
	-- The count, and one variant byte per event.
	local size = head + count
	for _, event in events do
		local kind = event.kind
		if kind == "chat" then
			local length = #event.text
			size += 4 + length + (if length < 254 then 1 elseif length <= 65535 then 3 else 5)
		elseif kind == "damage" then
			size += 6
		elseif kind == "despawn" then
			size += 4
		else
			size += 16
		end
	end

	local buf = buffer.create(size)
	if count < 254 then
		buffer.writeu8(buf, 0, count)
	else
		writeLongCount(buf, 0, count)
	end
	local offset = head
	for _, event in events do
		local kind = event.kind
		if kind == "chat" then
			local text = event.text
			local length = #text
			buffer.writeu8(buf, offset, 0)
			buffer.writeu32(buf, offset + 1, event.id)
			if length < 254 then
				buffer.writeu8(buf, offset + 5, length)
				offset += 6
			else
				writeLongCount(buf, offset + 5, length)
				offset += if length <= 65535 then 8 else 10
			end
			buffer.writestring(buf, offset, text)
			offset += length
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
	local count = buffer.readu8(buf, 0)
	local offset = 1
	if count >= 254 then
		count, offset = readLongCount(buf, 0, count)
	end
	local events = table.create(count)

	for index = 1, count do
		local variant = buffer.readu8(buf, offset)
		if variant == 0 then
			local id = buffer.readu32(buf, offset + 1)
			local length = buffer.readu8(buf, offset + 5)
			if length >= 254 then
				length, offset = readLongCount(buf, offset + 5, length)
			else
				offset += 6
			end
			events[index] = { kind = "chat", id = id, text = buffer.readstring(buf, offset, length) }
			offset += length
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
		local length = #label
		size += length + (if length < 254 then 1 elseif length <= 65535 then 3 else 5)
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
		if length < 254 then
			buffer.writeu8(buf, offset, length)
			offset += 1
		else
			writeLongCount(buf, offset, length)
			offset += if length <= 65535 then 3 else 5
		end
		buffer.writestring(buf, offset, label)
		offset += length
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
		local length = buffer.readu8(buf, offset)
		if length >= 254 then
			length, offset = readLongCount(buf, offset, length)
		else
			offset += 1
		end
		label = buffer.readstring(buf, offset, length)
		offset += length
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
	local head = if count < 254 then 1 elseif count <= 65535 then 3 else 5
	-- The count, and each entry's name, score and user id.
	local size = head + 12 * count
	for _, entry in entries do
		local length = #entry.name
		size += length + (if length < 254 then 1 elseif length <= 65535 then 3 else 5)
	end

	local buf = buffer.create(size)
	if count < 254 then
		buffer.writeu8(buf, 0, count)
	else
		writeLongCount(buf, 0, count)
	end
	local offset = head
	for _, entry in entries do
		local name = entry.name
		local length = #name
		if length < 254 then
			buffer.writeu8(buf, offset, length)
			offset += 1
		else
			writeLongCount(buf, offset, length)
			offset += if length <= 65535 then 3 else 5
		end
		buffer.writestring(buf, offset, name)
		offset += length
		buffer.writeu32(buf, offset, entry.score)
		buffer.writef64(buf, offset + 4, entry.userId)
		offset += 12
	end
	return buf
end

local function readLeaderboard(buf)
	local count = buffer.readu8(buf, 0)
	local offset = 1
	if count >= 254 then
		count, offset = readLongCount(buf, 0, count)
	end
	local entries = table.create(count)
	for index = 1, count do
		local length = buffer.readu8(buf, offset)
		if length >= 254 then
			length, offset = readLongCount(buf, offset, length)
		else
			offset += 1
		end
		local name = buffer.readstring(buf, offset, length)
		offset += length
		entries[index] = {
			name = name,
			score = buffer.readu32(buf, offset),
			userId = buffer.readf64(buf, offset + 4),
		}
		offset += 12
	end
	return { entries = entries }
end

-- A tree's size is not known without walking it, so it is written in one walk into a buffer
-- kept between calls, and copied out at its length, rather than walked once to count the nodes
-- and again to write them. Every node is its child count and a u16 id.
local treeScratch = buffer.create(64)
local treeCapacity = 64

local function growTree(needed)
	local grown = buffer.create(math.max(needed, treeCapacity * 2))
	buffer.copy(grown, 0, treeScratch)
	treeScratch = grown
	treeCapacity = buffer.len(grown)
end

local function writeTreeNode(offset, node)
	local children = node.children
	local count = #children
	-- Room for the longest form of the count.
	if offset + 5 > treeCapacity then
		growTree(offset + 5)
	end
	if count < 254 then
		buffer.writeu8(treeScratch, offset, count)
		offset += 1
	else
		writeLongCount(treeScratch, offset, count)
		offset += if count <= 65535 then 3 else 5
	end
	for _, child in children do
		offset = writeTreeNode(offset, child)
	end
	if offset + 2 > treeCapacity then
		growTree(offset + 2)
	end
	buffer.writeu16(treeScratch, offset, node.id)
	return offset + 2
end

local function writeTree(value)
	local length = writeTreeNode(0, value)
	local buf = buffer.create(length)
	buffer.copy(buf, 0, treeScratch, 0, length)
	return buf
end

local function readTreeNode(buf, offset)
	local count = buffer.readu8(buf, offset)
	if count >= 254 then
		count, offset = readLongCount(buf, offset, count)
	else
		offset += 1
	end
	local children = table.create(count)
	for index = 1, count do
		children[index], offset = readTreeNode(buf, offset)
	end
	return { children = children, id = buffer.readu16(buf, offset) }, offset + 2
end

local function readTree(buf)
	return (readTreeNode(buf, 0))
end

local function writeTuples(value)
	local samples = value.samples
	local count = #samples
	local head = if count < 254 then 1 elseif count <= 65535 then 3 else 5
	-- One allocation: every tuple is a u16 and two f32.
	local buf = buffer.create(head + 10 * count)
	if count < 254 then
		buffer.writeu8(buf, 0, count)
	else
		writeLongCount(buf, 0, count)
	end
	local offset = head
	for _, sample in samples do
		buffer.writeu16(buf, offset, sample[1])
		buffer.writef32(buf, offset + 2, sample[2])
		buffer.writef32(buf, offset + 6, sample[3])
		offset += 10
	end
	return buf
end

local function readTuples(buf)
	local count = buffer.readu8(buf, 0)
	local offset = 1
	if count >= 254 then
		count, offset = readLongCount(buf, 0, count)
	end
	local samples = table.create(count)
	for index = 1, count do
		samples[index] = { buffer.readu16(buf, offset), buffer.readf32(buf, offset + 2), buffer.readf32(buf, offset + 6) }
		offset += 10
	end
	return { samples = samples }
end

local function writeNestedArrays(value)
	local rows = value.rows
	local count = #rows
	local head = if count < 254 then 1 elseif count <= 65535 then 3 else 5
	-- The count, and each row's count and two bytes an element.
	local size = head
	for _, row in rows do
		local length = #row
		size += 2 * length + (if length < 254 then 1 elseif length <= 65535 then 3 else 5)
	end

	local buf = buffer.create(size)
	if count < 254 then
		buffer.writeu8(buf, 0, count)
	else
		writeLongCount(buf, 0, count)
	end
	local offset = head
	for _, row in rows do
		local length = #row
		if length < 254 then
			buffer.writeu8(buf, offset, length)
			offset += 1
		else
			writeLongCount(buf, offset, length)
			offset += if length <= 65535 then 3 else 5
		end
		for _, element in row do
			buffer.writeu16(buf, offset, element)
			offset += 2
		end
	end
	return buf
end

local function readNestedArrays(buf)
	local count = buffer.readu8(buf, 0)
	local offset = 1
	if count >= 254 then
		count, offset = readLongCount(buf, 0, count)
	end
	local rows = table.create(count)
	for index = 1, count do
		local length = buffer.readu8(buf, offset)
		if length >= 254 then
			length, offset = readLongCount(buf, offset, length)
		else
			offset += 1
		end
		local row = table.create(length)
		for element = 1, length do
			row[element] = buffer.readu16(buf, offset)
			offset += 2
		end
		rows[index] = row
	end
	return { rows = rows }
end

local function writeInstanceRefs(value)
	local entries = value.entries
	local count = #entries
	local head = if count < 254 then 1 elseif count <= 65535 then 3 else 5
	local buf = buffer.create(head + 2 * count)
	local blobs = table.create(count)
	if count < 254 then
		buffer.writeu8(buf, 0, count)
	else
		writeLongCount(buf, 0, count)
	end
	for index, entry in entries do
		buffer.writeu16(buf, head - 2 + 2 * index, entry.health)
		blobs[index] = entry.model
	end
	return { buffer = buf, blobs = blobs }
end

local function readInstanceRefs(payload)
	local buf = payload.buffer
	local blobs = payload.blobs
	local count = buffer.readu8(buf, 0)
	local head = 1
	if count >= 254 then
		count, head = readLongCount(buf, 0, count)
	end
	local entries = table.create(count)
	for index = 1, count do
		entries[index] = { health = buffer.readu16(buf, head - 2 + 2 * index), model = blobs[index] }
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
	tuples = { write = writeTuples, read = readTuples },
	nestedArrays = { write = writeNestedArrays, read = readNestedArrays },
	instanceRefs = { write = writeInstanceRefs, read = readInstanceRefs },
}
