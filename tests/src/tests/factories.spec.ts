//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import {
	createBinarySerializer,
	createDeserializer,
	createSerializer,
	createBinarySerializer as makeSerializer,
} from "@rbxts/surge";

import { Rng, SharedShape, difference, hex, sharedShapeSerializer } from "../support";

interface Reading {
	sensor: string;
	values: number[];
}
const writeReading = createSerializer<Reading>();
const readReading = createDeserializer<Reading>();

// Transformer 5.13 in docs/specs/transformer.md: a factory that returns one
// side emits the recursion helpers of that side only, since its closure
// declares only that side's state.
interface Outline {
	title: string;
	children: Outline[];
	next?: Outline;
}
const writeOutline = createSerializer<Outline>();
const readOutline = createDeserializer<Outline>();
const aliasedSerializer = makeSerializer<Reading>();

// The second call site for `SharedShape`. The first is in `support.ts`.
const localSharedShapeSerializer = createBinarySerializer<SharedShape>();

class FactoriesTest {
	@Fact
	public roundTripsThroughASeparateSerializerAndDeserializer(): void {
		const value: Reading = { sensor: "thermal", values: [1, 2.5, -3] };
		const { buffer, blobs } = writeReading(value);
		Assert.equal(undefined, difference(value, readReading(buffer, blobs)));
	}

	@Fact
	public roundTripsARecursiveTypeThroughASeparateSerializerAndDeserializer(): void {
		const value: Outline = {
			title: "root",
			children: [
				{ title: "a", children: [] },
				{ title: "b", children: [{ title: "b1", children: [] }], next: { title: "c", children: [] } },
			],
		};
		const { buffer, blobs } = writeOutline(value);
		Assert.equal(undefined, difference(value, readOutline(buffer, blobs)));
	}

	@Fact
	public transformsAFactoryImportedUnderAnotherName(): void {
		const value: Reading = { sensor: "", values: [] };
		const { buffer, blobs } = aliasedSerializer.serialize(value);
		Assert.equal(undefined, difference(value, aliasedSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public deserializesAShapeWithNoBlobWithoutInputBlobs(): void {
		const value: Reading = { sensor: "s", values: [4] };
		const { buffer, blobs } = writeReading(value);
		Assert.empty(blobs);
		Assert.equal(undefined, difference(value, readReading(buffer)));
	}

	@Fact
	public writesTheSameBytesFromTwoCallSitesForOneType(): void {
		const rng = new Rng(13);
		for (const _ of $range(1, 50)) {
			const value: SharedShape = {
				zebra: rng.f64(),
				apple: rng.str(),
				mango: [rng.bool(), rng.bool()],
				kind: rng.bool() ? "left" : "right",
			};
			const here = hex(localSharedShapeSerializer.serialize(value).buffer);
			const there = hex(sharedShapeSerializer.serialize(value).buffer);
			Assert.equal(there, here);
			// Each side reads what the other wrote.
			const written = sharedShapeSerializer.serialize(value);
			Assert.equal(undefined, difference(value, localSharedShapeSerializer.deserialize(written.buffer)));
		}
	}
}

export = FactoriesTest;
