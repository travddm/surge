-- Zap twins of the fixture catalog in ../fixtures/, per section 4.4 of
-- docs/specs/benchmark-harness.md. Zap has no callable encoder, so every row is an
-- event fired at a mocked RemoteEvent: the adapter reads the bytes out of what SendEvents
-- flushes, minus the one event-id byte, and reads the value back through the tooling
-- decoder. That is also why every event is `from: Server` -- the server half is the one
-- the Lune runner can host, and the tooling decoder takes its side from its arguments.
--
-- Regenerate ../zap/{server,client,tooling}.luau with `mise run bench:definitions`. Zap emits
-- its type declarations in a different order on every regeneration. The bytes do not move, so
-- the size table is unchanged, but a diff under ../zap/ does not show that a definition changed.
opt server_output = "../zap/server.luau"
opt client_output = "../zap/client.luau"
opt tooling = true
opt tooling_output = "../zap/tooling.luau"
opt manual_event_loop = true

type SmallFlatStruct = struct {
	id: u32,
	x: f32,
	y: f32,
	z: f32,
	active: boolean,
}

event SmallFlat = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: SmallFlatStruct,
}

type Leaf = struct {
	name: string.binary,
	weight: f32,
}

type Third = struct {
	leaf: Leaf,
	flag: boolean,
}

type Second = struct {
	inner: Third,
	count: u16,
}

type First = struct {
	inner: Second,
	label: string.binary,
}

type NestedObject = struct {
	root: First,
	version: u8,
}

event Nested = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: NestedObject,
}

type LargeArray = struct {
	values: u16[],
}

event Large = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: LargeArray,
}

type LargeRecord = struct {
	entries: map { [string.binary]: u8 },
}

event Record = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: LargeRecord,
}

type StringHeavy = struct {
	title: string.binary,
	author: string.binary,
	lines: string.binary[],
}

event Strings = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: StringHeavy,
}

type Event = enum "kind" {
	spawn {
		id: u32,
		at: vector,
	},
	damage {
		id: u32,
		amount: u16,
	},
	chat {
		id: u32,
		text: string.binary,
	},
	despawn {
		id: u32,
	},
}

type TaggedUnion = struct {
	events: Event[],
}

event Tagged = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: TaggedUnion,
}

type Toggles = struct {
	a: boolean,
	b: boolean,
	c: boolean,
	d: boolean,
	e: boolean,
	f: boolean,
	g: boolean,
	h: boolean,
	i: boolean,
	j: boolean,
	level: u8,
	label: string.binary?,
	offset: i16?,
}

event Flags = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: Toggles,
}

type Transforms = struct {
	list: CFrame[],
}

event Frames = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: Transforms,
}

type Booleans = struct {
	values: boolean[0..1000],
}

event Bools = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: Booleans,
}

type Entity = struct {
	a: u8,
	b: u8,
	c: u8,
	d: u8,
	e: u8,
	f: u8,
}

type Entities = struct {
	entities: Entity[0..1000],
}

event Ents = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: Entities,
}

type WideStruct = struct {
	f1: f32,
	f2: f32,
	f3: f32,
	f4: f32,
	f5: f32,
	f6: f32,
	f7: f32,
	f8: f32,
	f9: f32,
	f10: f32,
	f11: f32,
	f12: f32,
	f13: f32,
	f14: f32,
	f15: f32,
	f16: f32,
	f17: f32,
	f18: f32,
	f19: f32,
	f20: f32,
	f21: f32,
	f22: f32,
	f23: f32,
	f24: f32,
	f25: f32,
	f26: f32,
	f27: f32,
	f28: f32,
	f29: f32,
	f30: f32,
	f31: f32,
	"f32": f32,
	f33: f32,
	f34: f32,
	f35: f32,
	f36: f32,
	f37: f32,
	f38: f32,
	f39: f32,
	f40: f32,
	f41: f32,
	f42: f32,
	f43: f32,
	f44: f32,
	f45: f32,
	f46: f32,
	f47: f32,
	f48: f32,
	f49: f32,
	f50: f32,
}

event Wide = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: WideStruct,
}

-- Parentheses are what make this parse: Zap reads an unparenthesised `|` as the end of the
-- declaration. It dispatches the variants with typeof at runtime, one per Luau type.
type Value = (string.binary | f64 | boolean)

type GuardedUnion = struct {
	values: Value[],
}

event Guarded = {
	from: Server,
	type: Reliable,
	call: SingleSync,
	data: GuardedUnion,
}
