import * as ts from "typescript";

import { Emitter } from "../src/emit";
import { CAPACITY, CURSOR, INITIAL_CAPACITY } from "../src/emit/constants";
import type { Capacity } from "../src/emit/fold";
import { foldCursor } from "../src/emit/fold";

/** Folds the cursor through the statements of `source`, and prints them. */
function fold(source: string, capacity?: Capacity): string {
	const file = ts.createSourceFile("fold.ts", source, ts.ScriptTarget.ES2019, false, ts.ScriptKind.TS);
	const emitter = new Emitter(ts, ts.factory, new Map(), {});
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
	return foldCursor(emitter, [...file.statements], CURSOR, capacity)
		.map((statement) => printer.printNode(ts.EmitHint.Unspecified, statement, file))
		.join("\n");
}

describe("cursor fold", () => {
	test("writes a head of fixed size at numbers, with no cursor left", () => {
		const folded = fold(`
			let __surge_cursor = 0;
			const pos1 = __surge_cursor;
			__surge_cursor = pos1 + 9;
			buffer.writef64(scratch, pos1, value.a);
			const pos2 = pos1 + 8;
			buffer.writeu8(scratch, pos2, value.b);
			const pos3 = __surge_cursor;
			__surge_cursor = pos3 + 2;
			buffer.writeu16(scratch, pos3, value.c);
			return scratch;
		`);
		expect(folded).toBe(
			[
				"buffer.writef64(scratch, 0, value.a);",
				"buffer.writeu8(scratch, 8, value.b);",
				"buffer.writeu16(scratch, 9, value.c);",
				"return scratch;",
			].join("\n"),
		);
	});

	test("drops a capacity check at a number the buffer always holds, and keeps one past it", () => {
		const source = `
			__surge_cursor = 0;
			const pos1 = __surge_cursor;
			__surge_cursor = pos1 + 64;
			if (__surge_cursor > __surge_capacity) {
				[__surge_scratch, __surge_capacity] = grow(__surge_scratch, pos1, __surge_cursor);
			}
			buffer.writef64(__surge_scratch, pos1, value.a);
			const pos2 = __surge_cursor;
			__surge_cursor = pos2 + 1;
			if (__surge_cursor > __surge_capacity) {
				[__surge_scratch, __surge_capacity] = grow(__surge_scratch, pos2, __surge_cursor);
			}
			buffer.writeu8(__surge_scratch, pos2, value.b);
			return finishWrite(__surge_scratch, __surge_cursor);
		`;
		expect(fold(source, { name: CAPACITY, floor: INITIAL_CAPACITY })).toBe(
			[
				"buffer.writef64(__surge_scratch, 0, value.a);",
				"if (65 > __surge_capacity) {",
				"    [__surge_scratch, __surge_capacity] = grow(__surge_scratch, 64, 65);",
				"}",
				"buffer.writeu8(__surge_scratch, 64, value.b);",
				"return finishWrite(__surge_scratch, 65);",
			].join("\n"),
		);
		// A cursor's buffer may hold fewer bytes than the scratch buffer starts with.
		expect(fold(source)).toContain("if (64 > __surge_capacity) {");
	});

	test("moves the cursor once for adjacent reservations past a position it does not know", () => {
		const folded = fold(`
			const pos1 = __surge_cursor;
			__surge_cursor = pos1 + 2;
			buffer.writeu16(scratch, pos1, value.a);
			const pos2 = __surge_cursor;
			__surge_cursor = pos2 + 1;
			buffer.writeu8(scratch, pos2, value.b);
			return finishWrite(scratch, __surge_cursor);
		`);
		expect(folded).toBe(
			[
				"const pos1 = __surge_cursor;",
				"buffer.writeu16(scratch, pos1, value.a);",
				"buffer.writeu8(scratch, pos1 + 2, value.b);",
				"__surge_cursor = pos1 + 3;",
				"return finishWrite(scratch, __surge_cursor);",
			].join("\n"),
		);
	});

	test("sets the cursor where an assignment it does not know reads it, as a number where it knows one", () => {
		const folded = fold(`
			let __surge_cursor = 0;
			const pos1 = __surge_cursor;
			__surge_cursor = pos1 + 4;
			buffer.writeu32(scratch, pos1, value.id);
			__surge_cursor = writeLongString(scratch, __surge_cursor, s, len);
			return finishWrite(scratch, __surge_cursor);
		`);
		expect(folded).toBe(
			[
				"let __surge_cursor = 0;",
				"buffer.writeu32(scratch, 0, value.id);",
				"__surge_cursor = writeLongString(scratch, 4, s, len);",
				"return finishWrite(scratch, __surge_cursor);",
			].join("\n"),
		);
	});

	test("sets the cursor in a branch rather than at the head, which another branch reads", () => {
		const folded = fold(`
			__surge_cursor = 0;
			if (count < 254) {
				const pos1 = __surge_cursor;
				__surge_cursor = pos1 + 1;
				buffer.writeu8(scratch, pos1, count);
			} else {
				[scratch, capacity, __surge_cursor] = growLongCount(scratch, capacity, __surge_cursor, count);
			}
			return finishWrite(scratch, __surge_cursor);
		`);
		// Each branch sets the cursor before anything reads it, so the head's
		// assignment goes.
		expect(folded).toBe(
			[
				"if (count < 254) {",
				"    buffer.writeu8(scratch, 0, count);",
				"    __surge_cursor = 1;",
				"}",
				"else {",
				"    [scratch, capacity, __surge_cursor] = growLongCount(scratch, capacity, 0, count);",
				"}",
				"return finishWrite(scratch, __surge_cursor);",
			].join("\n"),
		);
	});

	test("sets the cursor at the head where it moved only along the head before a branch", () => {
		const folded = fold(`
			let __surge_cursor = 0;
			const pos1 = __surge_cursor;
			__surge_cursor = pos1 + 4;
			buffer.writeu32(scratch, pos1, value.id);
			if (len < 254) {
				const pos2 = __surge_cursor;
				__surge_cursor = pos2 + (len + 1);
				buffer.writeu8(scratch, pos2, len);
			} else {
				__surge_cursor = writeLongString(scratch, __surge_cursor, s, len);
			}
			const pos3 = __surge_cursor;
			__surge_cursor = pos3 + 1;
			buffer.writeu8(scratch, pos3, value.tag);
			return scratch;
		`);
		expect(folded).toBe(
			[
				"let __surge_cursor = 4;",
				"buffer.writeu32(scratch, 0, value.id);",
				"if (len < 254) {",
				"    __surge_cursor = len + 5;",
				"    buffer.writeu8(scratch, 4, len);",
				"}",
				"else {",
				"    __surge_cursor = writeLongString(scratch, 4, s, len);",
				"}",
				"const pos3 = __surge_cursor;",
				"buffer.writeu8(scratch, pos3, value.tag);",
				"return scratch;",
			].join("\n"),
		);
	});

	test("keeps the head's assignment where a branch with no else may leave it to a later read", () => {
		const folded = fold(`
			__surge_cursor = 0;
			const pos1 = __surge_cursor;
			__surge_cursor = pos1 + 4;
			buffer.writeu32(scratch, pos1, value.id);
			if (flag) {
				__surge_cursor = writeLongString(scratch, __surge_cursor, s, len);
			}
			return finishWrite(scratch, __surge_cursor);
		`);
		expect(folded).toBe(
			[
				"__surge_cursor = 4;",
				"buffer.writeu32(scratch, 0, value.id);",
				"if (flag) {",
				"    __surge_cursor = writeLongString(scratch, 4, s, len);",
				"}",
				"return finishWrite(scratch, __surge_cursor);",
			].join("\n"),
		);
	});

	test("leaves a loop's body as it was written, but for the positions known before the loop", () => {
		const folded = fold(`
			let __surge_cursor = 0;
			const pos0 = __surge_cursor;
			__surge_cursor = pos0 + 4;
			buffer.writeu32(scratch, pos0, value.id);
			for (const item of list) {
				const pos1 = __surge_cursor;
				__surge_cursor = pos1 + 2;
				buffer.writeu8(scratch, pos1, item.a);
				const pos2 = pos1 + 1;
				buffer.writeu8(scratch, pos2, item.b);
				buffer.writeu8(scratch, pos0, item.c);
			}
			return scratch;
		`);
		expect(folded).toBe(
			[
				"let __surge_cursor = 4;",
				"buffer.writeu32(scratch, 0, value.id);",
				"for (const item of list) {",
				"    const pos1 = __surge_cursor;",
				"    __surge_cursor = pos1 + 2;",
				"    buffer.writeu8(scratch, pos1, item.a);",
				"    const pos2 = pos1 + 1;",
				"    buffer.writeu8(scratch, pos2, item.b);",
				"    buffer.writeu8(scratch, 0, item.c);",
				"}",
				"return scratch;",
			].join("\n"),
		);
	});

	test("keeps an assignment of the cursor it does not recognize", () => {
		const folded = fold(`
			let __surge_cursor = 0;
			const pos1 = __surge_cursor;
			__surge_cursor = pos1 + 4;
			__surge_cursor += extra;
			return finishWrite(scratch, __surge_cursor);
		`);
		expect(folded).toBe(
			[
				"let __surge_cursor = 4;",
				"__surge_cursor += extra;",
				"return finishWrite(scratch, __surge_cursor);",
			].join("\n"),
		);
	});

	test("leaves a block's position in it, setting the cursor before the block ends", () => {
		const folded = fold(`
			const pos0 = __surge_cursor;
			__surge_cursor = pos0 + (len + 1);
			{
				const pos1 = __surge_cursor;
				__surge_cursor = pos1 + 8;
				buffer.writef64(scratch, pos1, value.a);
			}
			return finishWrite(scratch, __surge_cursor);
		`);
		expect(folded).toBe(
			[
				"const pos0 = __surge_cursor;",
				"__surge_cursor = pos0 + (len + 1);",
				"{",
				"    const pos1 = __surge_cursor;",
				"    buffer.writef64(scratch, pos1, value.a);",
				"    __surge_cursor = pos1 + 8;",
				"}",
				"return finishWrite(scratch, __surge_cursor);",
			].join("\n"),
		);
	});
});
