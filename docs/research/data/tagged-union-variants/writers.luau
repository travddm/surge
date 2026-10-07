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

-- Probe variants of writeTaggedUnion, for attributing surge's gap on the tagged union row. Each
-- differs from writeTaggedUnion in one named way, except the copy, which does not differ at all,
-- and the surge-shaped one, which is surge's generated serialize.

local function writeTaggedUnionCopy(value)
	local events = value.events
	local count = #events
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

-- surge's generated serialize for this row, as rbxts-transformer-surge da35c52 emits it.
local function writeTaggedUnionAsSurge(value)
	local arr1 = value.events
	local size4 = 4
	for _, item2 in arr1 do
		local tag3 = item2.kind
		size4 += (if tag3 == "chat" then #item2.text + 8 elseif tag3 == "damage" then 6 elseif tag3 == "despawn" then 4 else 16) + 1
	end
	local __surge_scratch = buffer.create(size4)
	local __surge_cursor = 0
	local pos5 = __surge_cursor
	__surge_cursor = pos5 + 4
	buffer.writeu32(__surge_scratch, pos5, #arr1)
	for _, item6 in arr1 do
		local tag7 = item6.kind
		if tag7 == "chat" then
			local pos16 = __surge_cursor
			__surge_cursor = pos16 + 5
			buffer.writeu8(__surge_scratch, pos16, 0)
			local pos17 = pos16 + 1
			buffer.writeu32(__surge_scratch, pos17, item6.id)
			local s18 = item6.text
			local len19 = #s18
			local pos20 = __surge_cursor
			__surge_cursor = pos20 + (len19 + 4)
			buffer.writeu32(__surge_scratch, pos20, len19)
			buffer.writestring(__surge_scratch, pos20 + 4, s18)
		elseif tag7 == "damage" then
			local pos13 = __surge_cursor
			__surge_cursor = pos13 + 7
			buffer.writeu8(__surge_scratch, pos13, 1)
			local pos14 = pos13 + 1
			buffer.writeu16(__surge_scratch, pos14, item6.amount)
			local pos15 = pos13 + 3
			buffer.writeu32(__surge_scratch, pos15, item6.id)
		elseif tag7 == "despawn" then
			local pos11 = __surge_cursor
			__surge_cursor = pos11 + 5
			buffer.writeu8(__surge_scratch, pos11, 2)
			local pos12 = pos11 + 1
			buffer.writeu32(__surge_scratch, pos12, item6.id)
		else
			local pos8 = __surge_cursor
			__surge_cursor = pos8 + 17
			buffer.writeu8(__surge_scratch, pos8, 3)
			local pos9 = pos8 + 1
			buffer.writef32(__surge_scratch, pos9, item6.at.X)
			buffer.writef32(__surge_scratch, pos9 + 4, item6.at.Y)
			buffer.writef32(__surge_scratch, pos9 + 8, item6.at.Z)
			local pos10 = pos8 + 13
			buffer.writeu32(__surge_scratch, pos10, item6.id)
		end
	end
	return __surge_scratch
end

-- The size loop in surge's form: one if-expression for each event, with its variant byte added in it.
local function writeTaggedUnionSizeAsSurge(value)
	local events = value.events
	local count = #events
	local size = 4
	for _, event in events do
		local kind = event.kind
		size += (if kind == "chat" then #event.text + 8 elseif kind == "damage" then 6 elseif kind == "despawn" then 4 else 16) + 1
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

-- A spawn event's `at` read once for each component, as surge reads it.
local function writeTaggedUnionAtPerComponent(value)
	local events = value.events
	local count = #events
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
			buffer.writeu8(buf, offset, 3)
			buffer.writef32(buf, offset + 1, event.at.X)
			buffer.writef32(buf, offset + 5, event.at.Y)
			buffer.writef32(buf, offset + 9, event.at.Z)
			buffer.writeu32(buf, offset + 13, event.id)
			offset += 17
		end
	end
	return buf
end

-- A chat event's offset moved twice, once past its index and id and once past its string, as
-- surge's two reservations move its cursor.
local function writeTaggedUnionChatTwice(value)
	local events = value.events
	local count = #events
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
			buffer.writeu8(buf, offset, 0)
			buffer.writeu32(buf, offset + 1, event.id)
			offset += 5
			local text = event.text
			local length = #text
			buffer.writeu32(buf, offset, length)
			buffer.writestring(buf, offset + 4, text)
			offset += 4 + length
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

-- The size loop as one if-expression, with the variant bytes added once ahead of it.
local function writeTaggedUnionSizeExpression(value)
	local events = value.events
	local count = #events
	local size = 4 + count
	for _, event in events do
		local kind = event.kind
		size += if kind == "chat" then #event.text + 8 elseif kind == "damage" then 6 elseif kind == "despawn" then 4 else 16
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

-- The size loop as statements, with each event's variant byte added in its branch.
local function writeTaggedUnionSizePlusOne(value)
	local events = value.events
	local count = #events
	local size = 4
	for _, event in events do
		local kind = event.kind
		if kind == "chat" then
			size += 8 + #event.text + 1
		elseif kind == "damage" then
			size += 6 + 1
		elseif kind == "despawn" then
			size += 4 + 1
		else
			size += 16 + 1
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

