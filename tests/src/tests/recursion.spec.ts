//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { createBinarySerializer } from "@rbxts/surge";

import { Rng, difference } from "../support";

// Mutual recursion: neither type refers to itself directly.
interface Folder {
	name: string;
	entries: Entry[];
}
interface Entry {
	size: number;
	folder?: Folder;
}
const folderSerializer = createBinarySerializer<Folder>();

// Recursion through an optional, a `Map`, and a tuple.
interface Scope {
	parent?: Scope;
	children: Map<string, Scope>;
	pair?: [Scope, number];
}
const scopeSerializer = createBinarySerializer<Scope>();

// Recursion through arrays and tuples alone, with no object or union on the
// cycle (Transformer 4.11 in docs/specs/transformer.md).
type Nest = Nest[];
const nestSerializer = createBinarySerializer<Nest>();
type Branch = [number, Branch[]];
const branchSerializer = createBinarySerializer<Branch>();

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
		const { buffer, blobs } = folderSerializer.serialize(value);
		Assert.equal(undefined, difference(value, folderSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsRecursionThroughAnOptionalAMapAndATuple(): void {
		const leaf: Scope = { children: new Map() };
		const value: Scope = {
			parent: { children: new Map(), parent: leaf },
			children: new Map([["a", { children: new Map([["b", leaf]]) }]]),
			pair: [leaf, 5],
		};
		const { buffer, blobs } = scopeSerializer.serialize(value);
		Assert.equal(undefined, difference(value, scopeSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsRecursionThroughArraysAndTuplesAlone(): void {
		const nest: Nest = [[], [[], [[]]]];
		const writtenNest = nestSerializer.serialize(nest);
		Assert.equal(undefined, difference(nest, nestSerializer.deserialize(writtenNest.buffer, writtenNest.blobs)));

		const branch: Branch = [
			1,
			[
				[2, []],
				[3, [[4, []]]],
			],
		];
		const writtenBranch = branchSerializer.serialize(branch);
		Assert.equal(
			undefined,
			difference(branch, branchSerializer.deserialize(writtenBranch.buffer, writtenBranch.blobs)),
		);
	}

	@Fact
	public roundTripsRandomRecursiveValues(): void {
		const rng = new Rng(8);
		for (const _ of $range(1, 50)) {
			const folder = randomFolder(rng, 4);
			const writtenFolder = folderSerializer.serialize(folder);
			Assert.equal(
				undefined,
				difference(folder, folderSerializer.deserialize(writtenFolder.buffer, writtenFolder.blobs)),
			);

			const scope = randomScope(rng, 4);
			const writtenScope = scopeSerializer.serialize(scope);
			Assert.equal(
				undefined,
				difference(scope, scopeSerializer.deserialize(writtenScope.buffer, writtenScope.blobs)),
			);
		}
	}
}

export = RecursionTest;
