// Golden/invariant tests on the actual compiled `.luau` output (see
// "Golden/invariant tests" in docs/testing.md): they read text the real
// pipeline already produced, they don't execute anything. This is the
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

// Regression checks for docs/future-work/recursive-union-types.md,
// enum-encoding.md, and wire-format-determinism.md, against the real
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
