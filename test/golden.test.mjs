// Golden/invariant tests on the actual compiled `.luau` output, and on the
// package's own `out/index.d.ts` (see Golden checks in docs/testing.md): they
// read text the real pipeline already produced, they don't execute anything. This is the
// falsifiable claim the whole design rests on -- specialized code per shape
// at compile time, not a runtime interpreter reading a schema -- so these
// assert it stays true as an automated regression instead of only a
// one-time manual read of the output.
//
// Requires `tests/`'s own build to have already run (`npm run tests:install
// && npm run tests:compile` from the repo root, or `mise run ci`, which does
// both before this).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function readCompiledLuau(relativePath) {
	return readFileSync(join(here, "..", "tests", "out", relativePath), "utf8");
}

test("a non-recursive shape (Basic) never calls a surge_* recursion helper", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.doesNotMatch(luau, /surge_\w+_(?:write|read)/);
});

test("the Field IR's own discriminant tag never leaks into the emitted Luau", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.doesNotMatch(luau, /\bkind\s*==/);
	assert.doesNotMatch(luau, /\["kind"\]/);
});

test("a genuinely self-referential shape (TreeNode) does call its generated recursion helper", () => {
	// A positive control: without it, the two checks above would also pass on
	// a codegen path that silently stopped emitting anything.
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	assert.match(luau, /surge_TreeNode_\d+_(?:write|read)/);
});

// Regression check for the write cursor passed to a recursion helper. What it
// was measured as worth is in docs/research/recursion-write-cursor.md.
test("a recursion helper's write takes the write cursor and returns it", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	assert.match(luau, /local function surge_TreeNode_\d+_write\(value, __surge_cursor\)$/m);
	assert.match(luau, /^\s+__surge_cursor = surge_TreeNode_\d+_write\(item\d+, __surge_cursor\)$/m);
	assert.match(luau, /^\s+return __surge_cursor$/m);
});

// Regression checks for the recursive-union-types, enum-encoding and wire-format-determinism
// findings of docs/research/september-2026-review.md, against the real
// compiled output (not a unit-level reconstruction of the emitter's input).
test("a recursive discriminated union (Expr) compiles to its own recursion helper", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	assert.match(luau, /surge_Expr_\d+_(?:write|read)/);
});

test("an enum index is an O(1) table lookup, not a chain of .Name comparisons", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	assert.doesNotMatch(luau, /\.Name\s*==/);
	assert.match(luau, /_index\[/); // roblox-ts lowers `Map.get`/indexing on a compiled Map to a plain table index
});

test("a packed region is written and read inline, with no per-bit helper", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	assert.doesNotMatch(luau, /packBit\(/i);
	// Each byte of the region is read once, and each bit tested against it.
	assert.match(
		luau,
		/local (bits[0-9]+) = buffer[.]readu8[(]__surge_input, pos[0-9]+[)]\n[^]*?bit32[.]btest[(]\1, 2[)]/,
	);
});

// Regression check for the read loop of Transformer 5.7 in
// docs/specs/transformer.md.
test("a count-driven read is a numeric for loop, not a _shouldIncrement flag loop", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	// The positive control: without it, the check below would also pass on a
	// file that stopped emitting count-driven reads at all.
	// The index is `i` where the body stores at it, and `_i` where it does not.
	assert.match(luau, /for _?i\d+ = 1, count\d+ do/);
	assert.doesNotMatch(luau, /_shouldIncrement/);
});

// Regression check for the tagged-union literal. What it was measured as worth is in
// docs/research/generated-code-against-hand-written.md.
test("a tagged-union read builds the variant literal with its tag, not a copy of it", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	// The positive control: `Expr`'s `num` variant, whose discriminant is part
	// of the literal the read assigns rather than spread in afterwards.
	assert.match(luau, /result\d+ = \{\s*\n\s*kind = "num",/);
	// A spread lowers to `table.clone` plus `setmetatable(_object, nil)`.
	assert.doesNotMatch(luau, /table\.clone/);
});

// Regression check for the single CFrame reservation. What it was measured as worth is in
// docs/research/generated-code-against-hand-written.md.
test("an unpacked CFrame reserves its 24 bytes once, not 12 bytes twice", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	// A reservation is inline now: the cursor advances by 24 in one step,
	// where two would advance by 12 twice. On the write side the `CFrame`
	// variant of `PlacementOrLabel` shares the reservation with its index, so
	// the step is 25.
	assert.match(luau, /__surge_cursor = pos[0-9]+ [+] 25$/m);
	assert.match(luau, /__surge_readCursor = pos[0-9]+ [+] 24$/m);
	// The rotation vector's last component, written into the same reservation
	// the position was: an offset of 20 exists only when the two halves share
	// one reservation.
	assert.match(luau, /buffer[.]writef32[(]__surge_scratch, pos[0-9]+ [+] 20,/);
	assert.match(luau, /buffer[.]readf32[(]__surge_input, pos[0-9]+ [+] 20[)]/);
});

// Regression check for the single read of a CFrame's position. What it was
// measured as worth is in docs/research/per-element-encode.md.
test("an unpacked CFrame reads its Position once for its three components", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	assert.match(luau, /local position[0-9]+ = [a-zA-Z_0-9.]+[.]Position$/m);
	assert.match(luau, /buffer[.]writef32[(]__surge_scratch, pos[0-9]+ [+] 8, position[0-9]+[.]Z[)]/);
	assert.doesNotMatch(luau, /buffer[.]write[a-z0-9]+[(]__surge_scratch, .*[.]Position[.][XYZ]/);
});

// Regression check for the shared reservation. What it was measured as worth is in
// docs/research/generated-code-against-hand-written.md.
test("consecutive fixed-size fields share one reservation", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	// `Basic` starts with a `number` (f64, 8 bytes) and a `boolean` (1), so
	// those two share one 9-byte reservation instead of taking one each.
	assert.match(luau, /__surge_cursor = pos[0-9]+ [+] 9$/m);
	assert.match(luau, /__surge_readCursor = pos[0-9]+ [+] 9$/m);
	// A position computed from the shared one, which is what a run looks like.
	assert.match(luau, /local pos[0-9]+ = pos[0-9]+ [+] [0-9]+$/m);
	assert.match(luau, /local pos\d+ = pos\d+ \+ \d+/);
});

test("a nested object of fixed-size fields shares the reservation around it", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	// `Placed` is a u32, a nested f64 and i16, and a u8: one 15-byte
	// reservation on each side, not one before the nested object, one for it
	// and one after it.
	assert.match(luau, /__surge_cursor = pos[0-9]+ [+] 15$/m);
	assert.match(luau, /__surge_readCursor = pos[0-9]+ [+] 15$/m);
});

test("an array of fixed-size elements reserves them all once, ahead of its loop", () => {
	const luau = readCompiledLuau("tests/bytes.spec.luau");
	// `Containers.list` is a `u16[]`: one reservation of two bytes per
	// element on each side, and a position each element moves on.
	assert.match(luau, /__surge_cursor = pos[0-9]+ [+] #arr[0-9]+ [*] 2$/m);
	assert.match(luau, /__surge_readCursor = pos[0-9]+ [+] count[0-9]+ [*] 2$/m);
	assert.match(luau, /element[0-9]+ [+]= 2$/m);
});

test("a string reserves its count and its bytes at once", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	// `Basic.name` is a string: one reservation of its length and a u32
	// count, and one move of the read cursor past both.
	assert.match(luau, /__surge_cursor = pos[0-9]+ [+] [(]len[0-9]+ [+] 4[)]$/m);
	assert.match(luau, /__surge_readCursor = pos[0-9]+ [+] 4 [+] len[0-9]+$/m);
});

// Regression check for sizing a union. What it was measured as worth is in
// docs/research/exact-sizing-with-loops.md.
test("a union is sized by the variant its write picks, with the write's own tests", () => {
	const luau = readCompiledLuau("tests/unions.spec.luau");
	// `WithUnionArrays.readings` is an array of a tagged union, sized by a loop
	// over its elements, and the size tests each element's tag as its write
	// does. Each element's index byte is added once ahead of the loop, as
	// docs/research/tagged-union-closed.md measured.
	assert.match(
		luau,
		/local (arr[0-9]+) = value[.]readings\n[^]*?local (size[0-9]+) = #\1 [+] #arr[0-9]+ [+] 8\n\s+for _, (item[0-9]+) in \1 do\n\s+\2 [+]= [(]if \3[.]kind == "level" then 1 else #\3[.]text [+] 4[)]\n\s+end$/m,
	);
	// The write reads the tag once and tests it once, and the branch it takes
	// writes the variant's index in one reservation with the `u8` after it.
	assert.match(
		luau,
		/local (tag[0-9]+) = item[0-9]+[.]kind\n\s+if \1 == "level" then\n\s+local (pos[0-9]+) = __surge_cursor\n\s+__surge_cursor = \2 [+] 2\n\s+buffer[.]writeu8[(]__surge_scratch, \2, 0[)]$/m,
	);
	assert.doesNotMatch(luau, /local idx[0-9]+ = if /);
});

// Regression check for a tag read once by a size. What it was measured as worth
// is in docs/research/size-reads-tag-once.md.
test("a size that compares a tag more than once reads it once", () => {
	const luau = readCompiledLuau("tests/unions.spec.luau");
	// `WithSignals.last` is a union of three variants outside a loop. The size
	// binds its tag ahead of the result, and the write tests that local.
	assert.match(
		luau,
		/local (tag[0-9]+) = value[.]last[.]kind\n[^]*?local (size[0-9]+) = [(]if \1 == "level" then 1 elseif \1 == "on" then 0 else /,
	);
	assert.match(luau, /local __surge_cursor = 0\n\s+if tag[0-9]+ == "level" then$/m);
	assert.equal(luau.match(/value[.]last[.]kind/g).length, 1);
	// `WithSignals.signals` is an array of it: the size's loop reads each tag
	// into a local of its own.
	assert.match(
		luau,
		/for _, (item[0-9]+) in arr[0-9]+ do\n\s+local (tag[0-9]+) = \1[.]kind\n\s+size[0-9]+ [+]= [(]if \2 == "level" then 1 elseif \2 == "on" then 0 else #\1[.]text [+] 4[)]\n\s+end$/m,
	);
});

// Regression check for a datatype's value read once. What it was measured as
// worth is in docs/research/tagged-union-closed.md.
test("a datatype reads its value once, not once per component, inside a run", () => {
	const luau = readCompiledLuau("tests/bytes.spec.luau");
	// `Datatypes` is a `Color3`, a `Vector2` and a `Vector3` in one reservation.
	assert.match(
		luau,
		/__surge_cursor = (pos[0-9]+) [+] 23\n\s+local (vec[0-9]+) = value[.]offset\n\s+buffer[.]writef32[(]__surge_scratch, \1, \2[.]X[)]$/m,
	);
	assert.match(
		luau,
		/local (vec[0-9]+) = value[.]position\n\s+buffer[.]writef32[(]__surge_scratch, pos[0-9]+, \1[.]X[)]$/m,
	);
	assert.match(luau, /local (color[0-9]+) = value[.]tint\n\s+buffer[.]writeu8[(][^\n]*\1[.]R /m);
	assert.doesNotMatch(luau, /value[.](offset|position|tint)[.][XYZRGB]\b/);
});

// Regression check for a nested object's value read once. What it was measured
// as worth is in docs/research/nested-object-values.md.
test("a nested object reads its value once, not once per property", () => {
	const luau = readCompiledLuau("tests/packed.spec.luau");
	// `WithPackedSubtree.settings.audio` is two objects deep.
	assert.match(luau, /local (obj[0-9]+) = value[.]settings\n[^]*?local obj[0-9]+ = \1[.]audio$/m);
	assert.doesNotMatch(luau, /value[.]settings[.]audio[.]/);
});

// Regression check for a size read through the locals its write binds. What it
// was measured as worth is in docs/research/size-and-read-locals.md.
test("a size binds the locals its write reads, ahead of the result", () => {
	const luau = readCompiledLuau("tests/packed.spec.luau");
	// `WithPackedSubtree.settings.label` is a string one object deep. The size
	// reads its length through the object's local and a local of its own, and
	// the write reads the same two and takes no length again.
	assert.match(
		luau,
		/local (obj[0-9]+) = value[.]settings\n[^]*?local (s[0-9]+) = \1[.]label\n\s+local (len[0-9]+) = #\2\n\s+local __surge_scratch = buffer[.]create[(]\3 [+] 15[)]\n[^]*?__surge_cursor = pos[0-9]+ [+] [(]\3 [+] 4[)]\n[^]*?buffer[.]writestring[(]__surge_scratch, pos[0-9]+ [+] 4, \2[)]$/m,
	);
	assert.equal(luau.match(/[.]label$/gm).length, 1);
});

// Regression check for the read table created at its size. What it was
// measured as worth is in docs/research/sized-read-tables.md.
test("a read creates its table at its size and stores each element at its index", () => {
	const luau = readCompiledLuau("tests/bytes.spec.luau");
	// `Containers.list` is a `u16[]`, and `Containers.pair` a tuple of two
	// fixed elements and a rest.
	assert.match(luau, /local result[0-9]+ = table[.]create[(]count[0-9]+[)]$/m);
	assert.match(luau, /result[0-9]+\[i[0-9]+\] = buffer[.]readu16[(]/);
	assert.match(luau, /local tup[0-9]+ = table[.]create[(]2[)]$/m);
	assert.match(luau, /tup[0-9]+\[i[0-9]+ [+] 2\] = buffer[.]readu8[(]/);
	// A generated table is never appended to. The tests' own code appends to
	// tables of its own names, which carry no numeric suffix.
	assert.doesNotMatch(luau, /table[.]insert[(](result|tup|keypoints)[0-9]+,/);
});

test("a shape sized exactly creates its result at that size and checks no capacity", () => {
	// Every shape in `basic.spec` can be sized without a loop.
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.match(luau, /local __surge_scratch = buffer[.]create[(]len[0-9]+ [+] /);
	assert.match(luau, /local __surge_scratch = buffer[.]create[(]15[)]$/m);
	assert.doesNotMatch(luau, /__surge_capacity|__surge_grow|__surge_finishWrite[(]/);
	// A positive control: a recursive type is written through a helper, and
	// keeps the scratch buffer.
	const recursion = readCompiledLuau("tests/recursion.spec.luau");
	assert.match(recursion, /__surge_finishWrite[(]__surge_scratch, __surge_cursor[)]/);
});

// Regression check for the read state held in locals. What it was measured as
// worth is in docs/research/size-and-read-locals.md.
test("a deserialize that reaches no recursion helper holds its input and cursor in locals", () => {
	// No shape in `basic.spec` is recursive.
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.match(
		luau,
		/deserialize = function[(]input[)]\n\s+local __surge_input = input\n\s+local __surge_readCursor = 0$/m,
	);
	assert.doesNotMatch(luau, /^\s+__surge_input = /m);
	const checked = readCompiledLuau("tests/checks.spec.luau");
	assert.match(checked, /^\s+local __surge_inputLength = buffer[.]len[(]__surge_input[)]$/m);
	// A positive control: a recursive type's read helper takes no arguments and
	// reads the closure's state.
	const recursion = readCompiledLuau("tests/recursion.spec.luau");
	assert.match(recursion, /^\s+local __surge_input = buffer[.]create[(]0[)]$/m);
	assert.match(recursion, /^\s+__surge_input = input$/m);
});

// Regression check for the boundary of sizing by a loop. What it was measured
// as worth is in docs/research/exact-sizing-with-loops.md, and on an array of
// objects in docs/research/object-array-loop-sizing.md.
test("an array of unions or of objects is sized by a loop, and an array of anything else that varies is not", () => {
	const unions = readCompiledLuau("tests/unions.spec.luau");
	// `WithUnionArrays.scalars` is an array of a guarded union.
	assert.match(
		unions,
		/local (arr[0-9]+) = value[.]scalars\n[^]*?for _, (item[0-9]+) in \1 do\n\s+size[0-9]+ [+]= [(]if \2 == false then 0 /,
	);
	assert.match(unions, /\n\s+local __surge_scratch = buffer[.]create[(]size[0-9]+[)]$/m);
	// `WithNamedEntries.entries` is an array of objects that hold a string.
	const strings = readCompiledLuau("tests/strings.spec.luau");
	assert.match(
		strings,
		/local namedEntriesSerializer = [(]function[(][)]\n[^]*?for _, (item[0-9]+) in arr[0-9]+ do\n\s+size[0-9]+ [+]= #\1[.]name [+] /,
	);
	// `Grid` is a `number[][]`, whose rows vary in length: it keeps the
	// scratch buffer, where a loop measured slower.
	const collections = readCompiledLuau("tests/collections.spec.luau");
	assert.match(
		collections,
		/local gridSerializer = [(]function[(][)]\n\s+local __surge_scratch = buffer[.]create[(]64[)]$/m,
	);
});

// Regression check for sizing an array by its count where each element writes
// the same bytes but has no fixed size. What it was measured as worth is in
// docs/research/blob-array-sizing.md.
test("an array of objects that hold a blob is sized by its count", () => {
	const luau = readCompiledLuau("tests/roblox.spec.luau");
	// `WithBlobArray.entries` holds an Instance and a u16 in each element.
	assert.match(
		luau,
		/local blobArraySerializer = [(]function[(][)]\n[^]*?local (arr[0-9]+) = value[.]entries\n\s+local __surge_scratch = buffer[.]create[(]#\1 [*] 2 [+] 4[)]$/m,
	);
});

// Regression check for the conditional blob side channel. What it is worth is in
// docs/research/per-call-overhead.md.
test("a shape with no blob field pays nothing for the blob side channel", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	// `Basic` has no Instance, `unknown` or `any` field, so neither side
	// declares the blob channel's state -- the write side's list is a table
	// created on every serialize.
	for (const name of ["__surge_writeBlobs", "__surge_readBlobs"]) {
		assert.ok(!luau.includes(name), `${name} should not be emitted for a blob-free shape`);
	}
	// A positive control: the shapes that do have one still carry it.
	const withBlobs = readCompiledLuau("tests/roblox.spec.luau");
	assert.match(withBlobs, /local __surge_writeBlobs = \{\}$/m);
});

// Regression check for the blob channel inline, in the serializer's own
// state. What it was measured as worth is in docs/research/blob-channel-inline.md.
test("a blob is appended and read inline, with no call into the package", () => {
	const luau = readCompiledLuau("tests/roblox.spec.luau");
	// A blob is stored at a counted index, unless it is nil, rather than with
	// `table.insert`, as docs/research/blob-store-by-index.md measured.
	assert.match(
		luau,
		/if (blob[0-9]+) ~= nil then\n\s+__surge_writeBlobs\[__surge_writeBlobCount \+ 1\] = \1\n\s+__surge_writeBlobCount \+= 1$/m,
	);
	assert.doesNotMatch(luau, /table\.insert\(__surge_writeBlobs, /);
	assert.match(luau, /local blob[0-9]+ = __surge_readBlobs\[__surge_readBlobIndex \+ 1\]$/m);
	assert.doesNotMatch(luau, /__surge_(beginWriteBlobs|pushBlob|finishWriteBlobs|beginReadBlobs|nextBlob)/);
});

// Regression check for the blob list created at its length. What it was
// measured as worth is in docs/research/blob-list-length.md.
test("a blob list is created at the most blobs its value appends", () => {
	const luau = readCompiledLuau("tests/roblox.spec.luau");
	// `WithBlobArray.entries` holds one Instance in each element.
	assert.match(
		luau,
		/local blobArraySerializer = [(]function[(][)]\n[^]*?local __surge_writeBlobs = table[.]create[(]#arr[0-9]+[)]$/m,
	);
	// `WithAbsentUnknowns` has three optional blobs and an array of them, each
	// counted as present.
	assert.match(luau, /local __surge_writeBlobs = table[.]create[(]#arr[0-9]+ [+] 3[)]$/m);
});

// What the tables around a result cost is in docs/research/tables-around-serialize.md.
test("a shape with no blob field returns the buffer alone", () => {
	// `Basic` has no blob field, so `Serialized<Basic>` is `buffer`, and no
	// table is built around it. It is sized exactly, so that buffer is the one
	// `serialize` wrote into.
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.match(luau, /return __surge_scratch$/m);
	assert.doesNotMatch(luau, /buffer = __surge_scratch/);
	// A positive control: a shape with a blob field still returns its array.
	const withBlobs = readCompiledLuau("tests/roblox.spec.luau");
	assert.match(withBlobs, /blobs = __surge_writeBlobs,/);
});

test("deserialize takes what serialize returned, as one argument", () => {
	// `Basic`'s is the buffer itself.
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.match(luau, /deserialize = function\(input\)$/m);
	assert.match(luau, /__surge_input = input$/m);
	// A shape with a blob field takes the table, and reads both of its fields.
	const withBlobs = readCompiledLuau("tests/roblox.spec.luau");
	assert.match(withBlobs, /__surge_input = input\.buffer$/m);
	assert.match(withBlobs, /local __surge_readBlobs = input\.blobs$/m);
});

test("generated code imports its helpers from the package's abi module", () => {
	// `collections.spec` keeps the scratch buffer, so it calls `grow` and `finishWrite`.
	const luau = readCompiledLuau("tests/collections.spec.luau");
	assert.match(luau, /"@rbxts", "surge", "out", "abi"\)$/m);
	// The package's own exports hold the consumer API and no helper.
	const index = readFileSync(join(here, "..", "out", "index.d.ts"), "utf8");
	for (const name of ["finishWrite", "grow", "writePackedCFrame", "readPackedCFrame"]) {
		assert.doesNotMatch(index, new RegExp(`\\b${name}\\b`), `index.d.ts exports ${name}`);
	}
});

// Regression checks for the file directives: docs/research/native-on-the-package.md
// for the package, and Transformer 6.3 in
// docs/specs/transformer.md. These two read @rbxts/surge's own compiled output
// and the transformed tests place, not one or the other.
test("every compiled module of the package opens with its Luau file pragmas", () => {
	// A hot comment is honoured anywhere ahead of the first line of code, so
	// what this pins is that each one survives a header edit: `--!native` on
	// the two modules with hot runtime code, and `--!optimize 2` everywhere,
	// because a published place compiles at that level and Studio does not.
	const head = (name) =>
		readFileSync(join(here, "..", "out", name), "utf8")
			.split(/\r?\n/)
			.map((line) => line.trimEnd());
	for (const name of ["alloc", "cframe"]) {
		const lines = head(`${name}.luau`);
		assert.equal(lines[0], "--!native", `${name}.luau line 1`);
		assert.equal(lines[1], "--!optimize 2", `${name}.luau line 2`);
	}
	for (const name of ["data-type.luau", "serializer.luau"]) {
		const lines = head(name);
		assert.equal(lines[0], "--!optimize 2", `${name} line 1`);
		assert.notEqual(lines[1], "--!native", `${name} line 2`);
	}
	// `index` and `abi` are the exceptions and carry neither: roblox-ts emits
	// a re-export-only module as `local exports = {}` and assignments, so a
	// directive would land after code, where Luau ignores it and its linter
	// warns about it.
	for (const name of ["init.luau", "abi.luau"]) {
		assert.doesNotMatch(readFileSync(join(here, "..", "out", name), "utf8"), /^--!/m, name);
	}
});

test("a file directive survives the transformer's injected imports", () => {
	// The injected `local __surge_*` imports used to be emitted above the
	// directive, which left it behind `local TS = require(...)` where Luau
	// ignores it. Every compiled module of the tests place carries
	// `//!optimize 2` in source, so line 1 is where it has to come out.
	for (const path of ["tests/basic.spec.luau", "support.luau", "bench/speed.spec.luau"]) {
		const luau = readCompiledLuau(path);
		assert.equal(luau.split(/\r?\n/)[0].trimEnd(), "--!optimize 2", `${path} line 1`);
		// Once, not once at the top and once where it used to land.
		assert.equal(luau.split("--!optimize 2").length, 2, `${path} carries it once`);
	}
});

test("a serializer without `readChecks` carries no read-side check at all", () => {
	// The option is opt-in per call site, so the cost has to be absent from
	// every suite that did not ask for it -- not merely branch-not-taken.
	for (const path of ["tests/basic.spec.luau", "tests/collections.spec.luau", "tests/roblox.spec.luau"]) {
		const luau = readCompiledLuau(path);
		// The two errors of the blob channel are raised with or without checks
		// (Runtime API 4.5 and 4.6), so they are not checks.
		const checks = (luau.match(/@rbxts\/surge: deserialize[^"]*/g) ?? []).filter(
			(message) => !message.endsWith("blobs array"),
		);
		assert.deepEqual(checks, [], `${path} has a check`);
		assert.doesNotMatch(luau, /__surge_inputLength/, `${path} reads the input length`);
	}
});

test("a serializer with `readChecks` carries them", () => {
	// The other half of the claim above: the checks are really emitted, so the
	// absence elsewhere is the option working and not the test looking wrong.
	const luau = readCompiledLuau("tests/checks.spec.luau");
	assert.match(luau, /@rbxts\/surge: deserialize read past the end of the input buffer/);
	assert.match(luau, /@rbxts\/surge: deserialize found a count/);
	assert.match(luau, /__surge_inputLength = buffer\.len\(__surge_input\)/);
	// `deserialize` also takes `unknown`, and first checks that it is
	// `Serialized<T>`: `Flat`'s is a buffer, and `WithBlobs`'s the table.
	assert.match(luau, /@rbxts\/surge: deserialize was given something other than a buffer"/);
	assert.match(luau, /@rbxts\/surge: deserialize was given something other than a table of a buffer/);
});
