//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import type { Cursor } from "@rbxts/surge";
import { DataType, createCodec, createCursorCodec } from "@rbxts/surge";

import { difference, hex } from "../support";

// A cursor codec (Runtime API 3.15 to 3.18 in docs/specs/runtime-api.md)
// writes into and reads from a cursor the caller owns, which several codecs
// share in a batch.

interface Move {
	id: DataType.u16;
	at: Vector3;
}
const move = createCursorCodec<Move>();
const moveCodec = createCodec<Move>();

interface Chat {
	text: string;
	channel: DataType.u8;
}
const chat = createCursorCodec<Chat>();
const chatCodec = createCodec<Chat>();

interface Spawned {
	model: Instance;
	health: DataType.u16;
	tag?: unknown;
}
const spawned = createCursorCodec<Spawned>();

interface Node {
	id: DataType.u8;
	part: Instance;
	children: Node[];
}
const node = createCursorCodec<Node>();

interface Fixed {
	id: DataType.u32;
	flags: DataType.Packed<{ a: boolean; b: boolean; c: boolean }>;
}
const fixed = createCursorCodec<Fixed>();
const fixedCodec = createCodec<Fixed>();

interface Counted {
	list: DataType.u8[];
}
const countedChecked = createCursorCodec<Counted>({ readChecks: true });

function cursorOf(size: number): Cursor {
	return { buffer: buffer.create(size), offset: 0, blobs: [], blobIndex: 0 };
}

/** The bytes a cursor holds up to its offset. */
function written(cursor: Cursor): buffer {
	const bytes = buffer.create(cursor.offset);
	buffer.copy(bytes, 0, cursor.buffer, 0, cursor.offset);
	return bytes;
}

/** A cursor to read back what `cursor` wrote. */
function reading(cursor: Cursor): Cursor {
	return { buffer: cursor.buffer, offset: 0, blobs: cursor.blobs, blobIndex: 0 };
}

class CursorTest {
	@Fact
	public writesTwoCodecsIntoOneCursorAndReadsThemBackInOrder(): void {
		const first: Move = { id: 7, at: new Vector3(1, 2, 3) };
		const second: Chat = { text: "hello", channel: 2 };
		const third: Move = { id: 65535, at: new Vector3(-1, 0.5, 4) };
		const cursor = cursorOf(64);
		move.write(cursor, first);
		chat.write(cursor, second);
		move.write(cursor, third);
		// The same bytes, one after another, as `serialize` writes for each.
		Assert.equal(
			hex(moveCodec.serialize(first)) + hex(chatCodec.serialize(second)) + hex(moveCodec.serialize(third)),
			hex(written(cursor)),
		);
		const back = reading(cursor);
		Assert.equal(undefined, difference(first, move.read(back)));
		Assert.equal(undefined, difference(second, chat.read(back)));
		Assert.equal(undefined, difference(third, move.read(back)));
		Assert.equal(cursor.offset, back.offset);
	}

	@Fact
	public growsTheBufferAndKeepsTheBytesBeforeTheValue(): void {
		for (const start of [0, 1]) {
			const cursor = cursorOf(start);
			const values = new Array<Chat>();
			for (const i of $range(1, 20)) {
				const value: Chat = { text: string.rep("x", i), channel: i };
				values.push(value);
				chat.write(cursor, value);
			}
			Assert.equal(true, buffer.len(cursor.buffer) >= cursor.offset);
			const back = reading(cursor);
			for (const value of values) {
				Assert.equal(undefined, difference(value, chat.read(back)));
			}
			Assert.equal(cursor.offset, back.offset);
		}
	}

	@Fact
	public appendsBlobsAfterTheOnesAlreadyInTheCursor(): void {
		const first = new Instance("Part");
		const second = new Instance("Folder");
		const cursor = cursorOf(16);
		cursor.blobs.push("before");
		move.write(cursor, { id: 1, at: Vector3.zero });
		spawned.write(cursor, { model: first, health: 10 });
		spawned.write(cursor, { model: second, health: 20, tag: "tagged" });
		Assert.equal(4, cursor.blobs.size());
		const back = reading(cursor);
		back.blobIndex = 1;
		Assert.equal(1, move.read(back).id);
		const one = spawned.read(back);
		Assert.equal(first, one.model);
		Assert.equal(undefined, one.tag);
		const two = spawned.read(back);
		Assert.equal(second, two.model);
		Assert.equal("tagged", two.tag);
		Assert.equal(4, back.blobIndex);
	}

	@Fact
	public writesAndReadsARecursiveTypeThroughACursor(): void {
		const parts = [new Instance("Part"), new Instance("Part"), new Instance("Part")];
		const value: Node = {
			id: 1,
			part: parts[0],
			children: [
				{ id: 2, part: parts[1], children: [] },
				{ id: 3, part: parts[2], children: [] },
			],
		};
		const cursor = cursorOf(0);
		// Twice, so state left over from the first write would show in the second.
		node.write(cursor, value);
		node.write(cursor, value);
		Assert.equal(6, cursor.blobs.size());
		const back = reading(cursor);
		for (const _ of $range(1, 2)) {
			const result = node.read(back);
			Assert.equal(parts[0], result.part);
			Assert.equal(3, result.children[1].id);
			Assert.equal(parts[2], result.children[1].part);
		}
		Assert.equal(cursor.offset, back.offset);
	}

	@Fact
	public givesTheConstantSizeOfATypeThatHasOne(): void {
		const value: Fixed = { id: 4_000_000_000, flags: { a: true, b: false, c: true } };
		Assert.equal(buffer.len(fixedCodec.serialize(value)), fixed.size);
		Assert.equal(5, fixed.size);
		Assert.equal(undefined, chat.size);
	}

	@Fact
	public boundsAReadByTheBufferNotByTheValue(): void {
		// Two values, the first of two elements. A count of three in the first
		// fits the buffer, which holds the second value after it, so it is read,
		// and its third element is the first byte of the second value's count.
		const cursor = cursorOf(32);
		countedChecked.write(cursor, { list: [1, 2] });
		countedChecked.write(cursor, { list: [3] });
		buffer.writeu32(cursor.buffer, 0, 3);
		const back = reading(cursor);
		Assert.equal(undefined, difference({ list: [1, 2, 1] }, countedChecked.read(back)));
	}
}

export = CursorTest;
