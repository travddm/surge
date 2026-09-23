//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng, difference } from "../support";

interface Point {
	x: number;
	y: number;
}

interface WithDictionaries {
	byId: Record<number, string>;
	readonlyMap: ReadonlyMap<string, Point>;
	readonlySet: ReadonlySet<number>;
	indexed: { [key: string]: boolean };
}
const dictionariesSerializer = createBinarySerializer<WithDictionaries>();

interface WithTuples {
	rest: [string, ...number[]];
	optionalTail: [number, string?];
	nested: [Point, [boolean, Point[]]];
}
const tuplesSerializer = createBinarySerializer<WithTuples>();

interface WithNestedOptionals {
	point?: Point;
	list?: number[];
	inner?: { deep?: { value?: string } };
	items: Array<Point | undefined>;
}
const optionalsSerializer = createBinarySerializer<WithNestedOptionals>();

type Grid = number[][];
const gridSerializer = createBinarySerializer<Grid>();

// Every kind that writes a count, each bounded to a narrower one. The
// counts are read back at the same width they were written at, which a byte
// pin alone would not show (see future-work/data-type-surface.md).
interface WithBounds {
	bytes: DataType.Length<buffer, DataType.u8>;
	list: DataType.Length<Point[], DataType.u8>;
	nested: DataType.Length<Array<DataType.Length<string, DataType.u8>>, DataType.u16>;
	pair: DataType.Length<[string, ...number[]], DataType.u8>;
	record: DataType.Length<Record<string, DataType.u8>, DataType.u8>;
	set: DataType.Length<Set<string>, DataType.u8>;
	text: DataType.Length<string, DataType.u16>;
}
const boundsSerializer = createBinarySerializer<WithBounds>();

// The exact form, where the count lives in the type and not in the buffer.
// The value has to have exactly this many; these always do.
const EXACT_ELEMENTS = 3;
const EXACT_BYTES = 5;
interface WithExactLengths {
	bytes: DataType.Length<buffer, 5>;
	list: DataType.Length<Point[], 3>;
	pair: DataType.Length<[string, ...number[]], 3>;
	text: DataType.Length<string, 5>;
}
const exactSerializer = createBinarySerializer<WithExactLengths>();

const FUZZ_ITERATIONS = 100;

function randomPoint(rng: Rng): Point {
	return { x: rng.f64(), y: rng.f64() };
}

class CollectionsTest {
	@Fact
	public roundTripsDictionaries(): void {
		const value: WithDictionaries = {
			byId: { [1]: "one", [-7]: "minus seven", [1.5]: "fraction" },
			readonlyMap: new Map([
				["a", { x: 1, y: 2 }],
				["", { x: 3, y: 4 }],
			]),
			readonlySet: new Set([0, -1, 2 ** 40]),
			indexed: { yes: true, no: false },
		};
		const { buffer, blobs } = dictionariesSerializer.serialize(value);
		Assert.equal(undefined, difference(value, dictionariesSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsEmptyDictionaries(): void {
		const value: WithDictionaries = { byId: {}, readonlyMap: new Map(), readonlySet: new Set(), indexed: {} };
		const { buffer: buf, blobs } = dictionariesSerializer.serialize(value);
		// Four u32 counts and nothing else.
		Assert.equal(4 * 4, buffer.len(buf));
		Assert.equal(undefined, difference(value, dictionariesSerializer.deserialize(buf, blobs)));
	}

	@Fact
	public roundTripsTuples(): void {
		const value: WithTuples = {
			rest: ["head", 1, 2, 3],
			optionalTail: [7, "tail"],
			nested: [{ x: 1, y: 2 }, [true, [{ x: 3, y: 4 }]]],
		};
		const { buffer, blobs } = tuplesSerializer.serialize(value);
		Assert.equal(undefined, difference(value, tuplesSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsATupleWithAnEmptyRestAndAnAbsentOptionalElement(): void {
		const value: WithTuples = { rest: ["head"], optionalTail: [7], nested: [{ x: 0, y: 0 }, [false, []]] };
		const { buffer, blobs } = tuplesSerializer.serialize(value);
		Assert.equal(undefined, difference(value, tuplesSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsNestedOptionalsWhenPresent(): void {
		const value: WithNestedOptionals = {
			point: { x: 1, y: 2 },
			list: [],
			inner: { deep: { value: "found" } },
			items: [
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
			],
		};
		const { buffer, blobs } = optionalsSerializer.serialize(value);
		Assert.equal(undefined, difference(value, optionalsSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsNestedOptionalsAbsentAtEachDepth(): void {
		for (const inner of [undefined, {}, { deep: {} }] as Array<WithNestedOptionals["inner"]>) {
			const value: WithNestedOptionals = { inner, items: [] };
			const { buffer, blobs } = optionalsSerializer.serialize(value);
			Assert.equal(undefined, difference(value, optionalsSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public roundTripsRandomCollections(): void {
		const rng = new Rng(4);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const byId: Record<number, string> = {};
			const readonlyMap = new Map<string, Point>();
			const readonlySet = new Set<number>();
			const indexed: { [key: string]: boolean } = {};
			for (const __ of $range(1, rng.int(0, 6))) {
				byId[rng.int(-1000, 1000)] = rng.str();
				readonlyMap.set(rng.str(), randomPoint(rng));
				readonlySet.add(rng.f64());
				indexed[rng.str()] = rng.bool();
			}
			const dictionaries: WithDictionaries = { byId, readonlyMap, readonlySet, indexed };
			const written = dictionariesSerializer.serialize(dictionaries);
			Assert.equal(
				undefined,
				difference(dictionaries, dictionariesSerializer.deserialize(written.buffer, written.blobs)),
			);

			const grid: Grid = [];
			for (const __ of $range(1, rng.int(0, 5))) {
				const row = new Array<number>();
				for (const ___ of $range(1, rng.int(0, 5))) {
					row.push(rng.f64());
				}
				grid.push(row);
			}
			const writtenGrid = gridSerializer.serialize(grid);
			Assert.equal(
				undefined,
				difference(grid, gridSerializer.deserialize(writtenGrid.buffer, writtenGrid.blobs)),
			);
		}
	}

	@Fact
	public roundTripsRandomOptionals(): void {
		const rng = new Rng(5);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const value: WithNestedOptionals = {
				point: rng.bool() ? randomPoint(rng) : undefined,
				list: rng.bool() ? [rng.f64(), rng.f64()] : undefined,
				inner: rng.bool()
					? { deep: rng.bool() ? { value: rng.bool() ? rng.str() : undefined } : undefined }
					: undefined,
				// Always present: a Luau array cannot hold `undefined`.
				items: [randomPoint(rng), randomPoint(rng)],
			};
			const { buffer, blobs } = optionalsSerializer.serialize(value);
			Assert.equal(undefined, difference(value, optionalsSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public roundTripsRandomBoundedContainers(): void {
		const rng = new Rng(11);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const rest = new Array<number>();
			for (const __ of $range(1, rng.int(0, 6))) {
				rest.push(rng.f64());
			}
			const list = new Array<Point>();
			for (const __ of $range(1, rng.int(0, 6))) {
				list.push(randomPoint(rng));
			}
			const nested = new Array<string>();
			for (const __ of $range(1, rng.int(0, 6))) {
				nested.push(rng.str());
			}
			const value: WithBounds = {
				bytes: buffer.fromstring(rng.str()),
				list,
				nested,
				pair: [rng.str(), ...rest],
				record: { [rng.str()]: rng.int(0, 255) },
				set: new Set([rng.str(), rng.str()]),
				text: rng.str(),
			};
			const { buffer: written, blobs } = boundsSerializer.serialize(value);
			Assert.equal(undefined, difference(value, boundsSerializer.deserialize(written, blobs)));
		}
	}

	@Fact
	public roundTripsRandomExactLengthContainers(): void {
		const rng = new Rng(12);
		for (const _ of $range(1, FUZZ_ITERATIONS)) {
			const list = new Array<Point>();
			const rest = new Array<number>();
			for (const __ of $range(1, EXACT_ELEMENTS)) {
				list.push(randomPoint(rng));
				rest.push(rng.f64());
			}
			// Exactly EXACT_BYTES bytes: the brand states the length and
			// nothing checks it, so a shorter value would raise.
			const text = string.rep("x", EXACT_BYTES);
			const value: WithExactLengths = {
				bytes: buffer.fromstring(text),
				list,
				pair: [text, ...rest],
				text,
			};
			const { buffer: written, blobs } = exactSerializer.serialize(value);
			Assert.equal(undefined, difference(value, exactSerializer.deserialize(written, blobs)));
		}
	}
}

export = CollectionsTest;
