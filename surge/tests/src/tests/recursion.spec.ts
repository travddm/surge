//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createCodec } from "@rbxts/surge";

import { Rng, difference, hex } from "../support";

// Mutual recursion: neither type refers to itself directly.
interface Folder {
	name: string;
	entries: Entry[];
}
interface Entry {
	size: number;
	folder?: Folder;
}
const folderSerializer = createCodec<Folder>();

// Recursion through an optional, a `Map`, and a tuple.
interface Scope {
	parent?: Scope;
	children: Map<string, Scope>;
	pair?: [Scope, number];
}
const scopeSerializer = createCodec<Scope>();

// Recursion through arrays and tuples alone, with no object or union on the
// cycle (Transformer 4.11 in docs/specs/transformer.md).
type Nest = Nest[];
const nestSerializer = createCodec<Nest>();
type Branch = [number, Branch[]];
const branchSerializer = createCodec<Branch>();

// Recursion through a dictionary alone, an index signature or a `Map` that
// holds itself, with no object of properties or union on the cycle.
interface Tree {
	[name: string]: Tree;
}
const treeSerializer = createCodec<Tree>();
type Graph = Map<string, Graph>;
const graphSerializer = createCodec<Graph>();

// A count width around the container the cycle runs through.
type Rows = DataType.Length<Rows[], DataType.u8>;
const rowsSerializer = createCodec<Rows>();
type Counted = DataType.Length<Map<string, Counted>, DataType.u16>;
const countedSerializer = createCodec<Counted>();

function randomFolder(rng: Rng, depth: number): Folder {
	const entries = new Array<Entry>();
	for (const _ of $range(1, rng.int(0, 3))) {
		entries.push({ size: rng.f64(), folder: depth > 0 && rng.bool() ? randomFolder(rng, depth - 1) : undefined });
	}
	return { name: rng.str(), entries };
}

function randomScope(rng: Rng, depth: number): Scope {
	const children = new Map<string, Scope>();
	if (depth > 0) {
		for (const _ of $range(1, rng.int(0, 2))) {
			children.set(rng.str(), randomScope(rng, depth - 1));
		}
	}
	return {
		parent: depth > 0 && rng.bool() ? randomScope(rng, depth - 1) : undefined,
		children,
		pair: depth > 0 && rng.bool() ? [randomScope(rng, depth - 1), rng.f64()] : undefined,
	};
}

class RecursionTest {
	@Fact
	public roundTripsMutualRecursion(): void {
		const value: Folder = {
			name: "root",
			entries: [{ size: 1 }, { size: 2, folder: { name: "child", entries: [{ size: 3 }] } }],
		};
		const buffer = folderSerializer.serialize(value);
		Assert.equal(undefined, difference(value, folderSerializer.deserialize(buffer)));
	}

	@Fact
	public roundTripsRecursionThroughAnOptionalAMapAndATuple(): void {
		const leaf: Scope = { children: new Map() };
		const value: Scope = {
			parent: { children: new Map(), parent: leaf },
			children: new Map([["a", { children: new Map([["b", leaf]]) }]]),
			pair: [leaf, 5],
		};
		const buffer = scopeSerializer.serialize(value);
		Assert.equal(undefined, difference(value, scopeSerializer.deserialize(buffer)));
	}

	@Fact
	public roundTripsRecursionThroughArraysAndTuplesAlone(): void {
		const nest: Nest = [[], [[], [[]]]];
		const writtenNest = nestSerializer.serialize(nest);
		Assert.equal(undefined, difference(nest, nestSerializer.deserialize(writtenNest)));

		const branch: Branch = [
			1,
			[
				[2, []],
				[3, [[4, []]]],
			],
		];
		const writtenBranch = branchSerializer.serialize(branch);
		Assert.equal(undefined, difference(branch, branchSerializer.deserialize(writtenBranch)));
	}

	@Fact
	public roundTripsRecursionThroughADictionaryAlone(): void {
		const tree: Tree = { a: {}, b: { c: {}, d: { e: {} } } };
		const writtenTree = treeSerializer.serialize(tree);
		Assert.equal(undefined, difference(tree, treeSerializer.deserialize(writtenTree)));

		const graph: Graph = new Map<string, Graph>([
			["a", new Map<string, Graph>()],
			["b", new Map<string, Graph>([["c", new Map<string, Graph>()]])],
		]);
		const writtenGraph = graphSerializer.serialize(graph);
		Assert.equal(undefined, difference(graph, graphSerializer.deserialize(writtenGraph)));
	}

	@Fact
	public roundTripsACountedContainerOfItself(): void {
		const rows: Rows = [[], [[]]];
		const writtenRows = rowsSerializer.serialize(rows);
		Assert.equal(undefined, difference(rows, rowsSerializer.deserialize(writtenRows)));

		const counted: Counted = new Map<string, Counted>([["a", new Map<string, Counted>()]]);
		const writtenCounted = countedSerializer.serialize(counted);
		// count 1 as a u16 | "a" | its value's count 0 as a u16
		Assert.equal("0100" + "0161" + "0000", hex(writtenCounted));
		Assert.equal(undefined, difference(counted, countedSerializer.deserialize(writtenCounted)));
	}

	@Fact
	public roundTripsRandomRecursiveValues(): void {
		const rng = new Rng(8);
		for (const _ of $range(1, 50)) {
			const folder = randomFolder(rng, 4);
			const writtenFolder = folderSerializer.serialize(folder);
			Assert.equal(undefined, difference(folder, folderSerializer.deserialize(writtenFolder)));

			const scope = randomScope(rng, 4);
			const writtenScope = scopeSerializer.serialize(scope);
			Assert.equal(undefined, difference(scope, scopeSerializer.deserialize(writtenScope)));
		}
	}
}

export = RecursionTest;
