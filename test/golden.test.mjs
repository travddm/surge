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

test("packed booleans never call a per-bit packBit helper in the compiled output", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	// `\b` excludes `unpackBit(`, which the read side still legitimately uses.
	assert.doesNotMatch(luau, /\bpackBit\(/);
});

// Regression check for the read-loop item in
// docs/future-work/generated-code-performance.md.
test("a count-driven read is a numeric for loop, not a _shouldIncrement flag loop", () => {
	const luau = readCompiledLuau("tests/coverage.spec.luau");
	// The positive control: without it, the check below would also pass on a
	// file that stopped emitting count-driven reads at all.
	assert.match(luau, /for _i\d+ = 1, count\d+ do/);
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
	// where two would advance by 12 twice.
	assert.match(luau, /__surge_cursor = pos[0-9]+ [+] 24$/m);
	assert.match(luau, /__surge_readCursor = pos[0-9]+ [+] 24$/m);
	// The rotation vector's last component, written into the same reservation
	// the position was: an offset of 20 exists only when the two halves share
	// one reservation.
	assert.match(luau, /buffer[.]writef32[(]__surge_scratch, pos[0-9]+ [+] 20,/);
	assert.match(luau, /buffer[.]readf32[(]__surge_input, pos[0-9]+ [+] 20[)]/);
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

// Regression check for the conditional blob side channel. What it is worth is in
// docs/research/per-call-overhead.md.
test("a shape with no blob field pays nothing for the blob side channel", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	// `Basic` has no Instance, `unknown` or `any` field, so none of the three
	// per-call blob entry points is emitted -- `beginWriteBlobs` allocates a
	// table on every serialize.
	for (const name of ["beginWriteBlobs", "finishWriteBlobs", "beginReadBlobs"]) {
		assert.ok(!luau.includes(`__surge_${name}(`), `${name} should not be emitted for a blob-free shape`);
	}
	// A positive control: the shapes that do have one still carry it.
	const withBlobs = readCompiledLuau("tests/roblox.spec.luau");
	assert.match(withBlobs, /__surge_beginWriteBlobs\(/);
});

// What the tables around a result cost is in docs/research/tables-around-serialize.md.
test("a shape with no blob field returns the buffer alone", () => {
	// `Basic` has no blob field, so `Serialized<Basic>` is `buffer`, and no
	// table is built around it.
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.match(luau, /return __surge_finishWrite\(__surge_scratch, __surge_cursor\)$/m);
	assert.doesNotMatch(luau, /buffer = __surge_finishWrite\(/);
	// A positive control: a shape with a blob field still returns its array.
	const withBlobs = readCompiledLuau("tests/roblox.spec.luau");
	assert.match(withBlobs, /blobs = __surge_finishWriteBlobs\(\),/);
});

test("deserialize takes what serialize returned, as one argument", () => {
	// `Basic`'s is the buffer itself.
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.match(luau, /deserialize = function\(input\)$/m);
	assert.match(luau, /__surge_input = input$/m);
	// A shape with a blob field takes the table, and reads both of its fields.
	const withBlobs = readCompiledLuau("tests/roblox.spec.luau");
	assert.match(withBlobs, /__surge_input = input\.buffer$/m);
	assert.match(withBlobs, /__surge_beginReadBlobs\(input\.blobs\)$/m);
});

test("generated code imports its helpers from the package's abi module", () => {
	const luau = readCompiledLuau("tests/basic.spec.luau");
	assert.match(luau, /"@rbxts", "surge", "out", "abi"\)$/m);
	// The package's own exports hold the consumer API and no helper.
	const index = readFileSync(join(here, "..", "out", "index.d.ts"), "utf8");
	for (const name of ["finishWrite", "grow", "pushBlob", "nextBlob", "unpackBit"]) {
		assert.doesNotMatch(index, new RegExp(`\\b${name}\\b`), `index.d.ts exports ${name}`);
	}
});

// Regression checks for the file directives: the package pragma entry in
// docs/future-work/generated-code-performance.md, and Transformer 6.3 in
// docs/specs/transformer.md. These two read @rbxts/surge's own compiled output
// and the transformed tests place, not one or the other.
test("every compiled module of the package opens with its Luau file pragmas", () => {
	// A hot comment is honoured anywhere ahead of the first line of code, so
	// what this pins is that each one survives a header edit: `--!native` on
	// the four modules with hot runtime code, and `--!optimize 2` everywhere,
	// because a published place compiles at that level and Studio does not.
	const head = (name) =>
		readFileSync(join(here, "..", "out", name), "utf8")
			.split(/\r?\n/)
			.map((line) => line.trimEnd());
	for (const name of ["alloc", "blobs", "cframe", "pack"]) {
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
		assert.doesNotMatch(luau, /@rbxts\/surge: deserialize/, `${path} has a check`);
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
