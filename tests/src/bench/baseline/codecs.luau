-- The hand-written "ideal flat serializer" from the Benchmarking strategy in docs/testing.md:
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
-- format and its timing means nothing. Field order is surge's, which sorts by name; see Transformer
-- Design in docs/transformer.md.
--
-- No `--!optimize` or `--!native` directive, deliberately: roblox-ts emits none, so surge's
-- generated modules run at whatever level the place is built with, and a directive here would
-- compile one side of the comparison differently from the other. surge's own package does carry
-- `--!native` on its hot modules, which is a different thing and measured as worth nothing on its
-- own; see Native code generation in docs/future-work/generated-code-performance.md.

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
	-- Sized up front, where surge's reader appends to an empty table: the count is on the wire, so
	-- a person writing this by hand would use it, and the decode gap on this row is partly that.
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

return {
	smallFlatStruct = { write = writeSmallFlatStruct, read = readSmallFlatStruct },
	nestedObject = { write = writeNestedObject, read = readNestedObject },
	transforms = { write = writeTransforms, read = readTransforms },
}
