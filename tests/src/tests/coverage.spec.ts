//!optimize 2
import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { difference } from "../support";

interface WithCollections {
	items: number[];
	pair: [string, number];
	record: Record<string, number>;
	map: Map<string, number>;
	set: Set<string>;
}
const collectionsSerializer = createBinarySerializer<WithCollections>();

interface WithRobloxTypes {
	position: Vector3;
	orientation: CFrame;
	tint: Color3;
	rig: Enum.HumanoidRigType;
}
const robloxSerializer = createBinarySerializer<WithRobloxTypes>();

// Wire format 4.6 in docs/specs/wire-format.md: Vector2 gets its own real 2xf32
// encoding instead of routing through the blob side channel.
interface WithVector2 {
	offset: Vector2;
}
const vector2Serializer = createBinarySerializer<WithVector2>();

// Transformer 4.1 in docs/specs/transformer.md: a Roblox datatype with no encoding of its own
// (unlike Vector2/Vector3/CFrame/Color3 above) must still round-trip, via its
// `_nominal_Vector2int16` brand routing it to the blob passthrough channel
// instead of being walked structurally.
interface WithUnencodedDatatype {
	offset: Vector2int16;
}
const unencodedDatatypeSerializer = createBinarySerializer<WithUnencodedDatatype>();

type Shape = { kind: "circle"; radius: number } | { kind: "rect"; width: number; height: number };
const shapeSerializer = createBinarySerializer<Shape>();

type StringOrNumber = string | number;
const guardedSerializer = createBinarySerializer<StringOrNumber>();

interface Flags {
	a: DataType.Packed<boolean>;
	b: DataType.Packed<boolean>;
	c: DataType.Packed<boolean>;
}
const flagsSerializer = createBinarySerializer<Flags>();

interface TreeNode {
	value: number;
	children: TreeNode[];
}
const treeSerializer = createBinarySerializer<TreeNode>();

// Each note below that opens with a name is a regression for the review finding of that
// name, listed with what closed it in docs/research/september-2026-review.md.

// walk-type-identity: two instantiations of one generic interface must
// classify independently (keyed by `ts.Type`, not the shared declaration
// symbol) instead of one silently reusing the other's `Field`.
interface Box<T> {
	v: T;
}
interface WithGenerics {
	a: Box<number>;
	b: Box<string>;
}
const genericsSerializer = createBinarySerializer<WithGenerics>();

// recursive-union-types: a recursive discriminated union used to crash
// the whole `rbxtsc` build with an uncaught stack overflow instead of
// compiling to a recursion helper.
type Expr = { kind: "num"; v: number } | { kind: "add"; l: Expr; r: Expr };
const exprSerializer = createBinarySerializer<Expr>();

// walker-emitter-robustness: property names that are not identifiers
// used to emit `value.my-key`/`value.0`, which is invalid TypeScript.
interface WithOddKeys {
	"my-key": number;
	0: string;
	// A different table key from `1` in Luau, so the generated code must quote it as well.
	"1": string;
	plain: boolean;
}
const oddKeysSerializer = createBinarySerializer<WithOddKeys>();

// walker-emitter-robustness: a Roblox datatype as a bare union member used
// to crash the emitter (`guardFor` had no case for it).
type PlacementOrLabel = CFrame | Vector2 | string;
const datatypeUnionSerializer = createBinarySerializer<PlacementOrLabel>();

// walker-emitter-robustness: so did a recursive object type as a bare
// union member.
interface Chain {
	label: string;
	next: Chain | string;
}
const chainSerializer = createBinarySerializer<Chain>();

// walker-emitter-robustness: a re-aliased `Packed<T>` used to be walked
// structurally, leaving the booleans byte-aligned and serializing the
// `_surge_packed` brand property as an extra field.
type PackedPair = DataType.Packed<{ first: boolean; second: boolean }>;
const packedPairSerializer = createBinarySerializer<PackedPair>();

// Transformer 5.8 in docs/specs/transformer.md: 100 fixed-size fields in one function used to
// exceed Luau's 200 registers, which fails when the module loads.
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Wide = { [K in `f${"0" | "1"}${Digit}${Digit}`]: number };
const WIDE_FIELD_COUNT = 200;
const wideSerializer = createBinarySerializer<Wide>();

// walker-emitter-robustness: a user declaration named after an injected
// `@rbxts/surge` import used to collide with it.
function alloc(): string {
	return "the user's own alloc";
}

// The enum-encoding finding's `Enum.KeyCode` width/O(1)-table fixture intentionally
// does not live here: the generated `{[name]: index}`/`EnumItem[]`
// tables are module constants built from *every* member up front (matching
// real Roblox), and this suite's headless Lune harness (Test harness 4.5 in
// docs/specs/test-harness.md) doesn't implement every
// real `Enum.KeyCode` member (confirmed missing at least `ButtonBack`), so
// simply loading such a module here throws before any test body runs.
// Covered instead at the transformer level -- `emit.test.ts` pins the u16
// width and table-lookup codegen, and `golden.test.mjs` asserts the same
// against this suite's own real compiled `coverage.spec.luau`.

class CoverageTest {
	@Fact
	public roundTripsCollections(): void {
		const value: WithCollections = {
			items: [1, 2, 3],
			pair: ["a", 1],
			record: { x: 1, y: 2 },
			map: new Map<string, number>([["k", 9]]),
			set: new Set<string>(["p", "q"]),
		};
		const { buffer, blobs } = collectionsSerializer.serialize(value);
		Assert.equal(undefined, difference(value, collectionsSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsRobloxTypes(): void {
		const value: WithRobloxTypes = {
			position: new Vector3(1, 2, 3),
			orientation: new CFrame(1, 2, 3),
			// A multiple of 1/255 per channel: a `Color3` is stored as 3 x u8.
			tint: Color3.fromRGB(128, 64, 191),
			rig: Enum.HumanoidRigType.R15,
		};
		const { buffer, blobs } = robloxSerializer.serialize(value);
		// Every component above is exact in an f32, so each datatype compares
		// equal. `roblox.spec.ts` covers a `CFrame` with a rotation.
		Assert.equal(undefined, difference(value, robloxSerializer.deserialize(buffer, blobs)));
	}

	@Fact
	public roundTripsVector2(): void {
		const value: WithVector2 = { offset: new Vector2(4, 5) };
		const { buffer: buf, blobs } = vector2Serializer.serialize(value);
		// 2xf32, not the 0-byte blob side channel -- this is the real encoding
		// of Wire format 4.6, not the passthrough fallback.
		Assert.equal(8, buffer.len(buf));
		const result = vector2Serializer.deserialize(buf, blobs);
		Assert.fuzzyEqual(value.offset.X, result.offset.X, 0.001);
		Assert.fuzzyEqual(value.offset.Y, result.offset.Y, 0.001);
	}

	@Fact
	public roundTripsUnencodedDatatypeAsAnOpaqueBlob(): void {
		const value: WithUnencodedDatatype = { offset: new Vector2int16(4, 5) };
		const { buffer: buf, blobs } = unencodedDatatypeSerializer.serialize(value);
		// Nothing is written into the buffer for a blob field -- this is the
		// whole point of the passthrough channel, and a real byte-size
		// assertion (not just round-trip equality) is what would have caught
		// the walker recursing into Vector2int16's declared properties instead.
		Assert.equal(0, buffer.len(buf));
		const result = unencodedDatatypeSerializer.deserialize(buf, blobs);
		Assert.equal(value.offset, result.offset);
	}

	@Fact
	public roundTripsTaggedUnion(): void {
		for (const value of [
			{ kind: "rect", width: 2, height: 3 },
			{ kind: "circle", radius: 1.5 },
		] as Shape[]) {
			const { buffer, blobs } = shapeSerializer.serialize(value);
			Assert.equal(undefined, difference(value, shapeSerializer.deserialize(buffer, blobs)));
		}
	}

	@Fact
	public roundTripsGuardedUnion(): void {
		const stringValue: StringOrNumber = "hello";
		const numberValue: StringOrNumber = 42;
		const { buffer: buf1, blobs: blobs1 } = guardedSerializer.serialize(stringValue);
		Assert.equal(stringValue, guardedSerializer.deserialize(buf1, blobs1));
		const { buffer: buf2, blobs: blobs2 } = guardedSerializer.serialize(numberValue);
		Assert.equal(numberValue, guardedSerializer.deserialize(buf2, blobs2));
	}

	@Fact
	public roundTripsPackedBooleans(): void {
		const value: Flags = { a: true, b: false, c: true };
		const { buffer: buf, blobs } = flagsSerializer.serialize(value);
		// Asserts the packed size, not just round-trip equality -- three
		// unpacked booleans would also round-trip correctly while silently
		// costing 3 bytes instead of 1, which a pure equality check can't catch.
		Assert.equal(1, buffer.len(buf));
		const result = flagsSerializer.deserialize(buf, blobs);
		Assert.equal(value.a, result.a);
		Assert.equal(value.b, result.b);
		Assert.equal(value.c, result.c);
	}

	@Fact
	public roundTripsRecursiveType(): void {
		const value: TreeNode = { value: 1, children: [{ value: 2, children: [] }] };
		const { buffer, blobs } = treeSerializer.serialize(value);
		const result = treeSerializer.deserialize(buffer, blobs);
		Assert.equal(value.value, result.value);
		Assert.equal(value.children[0].value, result.children[0].value);
	}

	@Fact
	public roundTripsTwoInstantiationsOfOneGeneric(): void {
		const value: WithGenerics = { a: { v: 7 }, b: { v: "seven" } };
		const { buffer, blobs } = genericsSerializer.serialize(value);
		const result = genericsSerializer.deserialize(buffer, blobs);
		// Asserts both instantiations decode with their own type, not `b`
		// silently sharing `a`'s `f64` field classification.
		Assert.equal(value.a.v, result.a.v);
		Assert.equal(value.b.v, result.b.v);
	}

	@Fact
	public roundTripsRecursiveDiscriminatedUnion(): void {
		const value: Expr = { kind: "add", l: { kind: "num", v: 1 }, r: { kind: "num", v: 2 } };
		const { buffer, blobs } = exprSerializer.serialize(value);
		const result = exprSerializer.deserialize(buffer, blobs);
		Assert.equal(value.kind, result.kind);
		if (value.kind === "add" && result.kind === "add") {
			Assert.equal(value.l.kind, result.l.kind);
			Assert.equal(value.r.kind, result.r.kind);
		}
	}

	@Fact
	public roundTripsPackedBooleansAfterALargerPriorPayload(): void {
		// Regression for the wire-format-determinism finding: the packed byte is now
		// computed from all its bits at once, so any bits unused by this
		// payload's field count must come back zero even when the shared
		// scratch buffer still holds a larger previous payload's bytes here.
		flagsSerializer.serialize({ a: true, b: true, c: true });
		const { buffer: buf, blobs } = flagsSerializer.serialize({ a: true, b: false, c: false });
		Assert.equal(1, buffer.readu8(buf, 0));
		const result = flagsSerializer.deserialize(buf, blobs);
		Assert.true(result.a);
		Assert.false(result.b);
		Assert.false(result.c);
	}
	@Fact
	public roundTripsPropertyNamesThatAreNotIdentifiers(): void {
		const value: WithOddKeys = { "my-key": 7, 0: "zero", "1": "one", plain: true };
		const { buffer, blobs } = oddKeysSerializer.serialize(value);
		const result = oddKeysSerializer.deserialize(buffer, blobs);
		Assert.equal(value["my-key"], result["my-key"]);
		Assert.equal(value[0], result[0]);
		Assert.equal(value["1"], result["1"]);
		Assert.equal(value.plain, result.plain);
	}

	@Fact
	public roundTripsRobloxDatatypesAsUnionMembers(): void {
		const label: PlacementOrLabel = "spawn";
		const { buffer: buf1, blobs: blobs1 } = datatypeUnionSerializer.serialize(label);
		Assert.equal(label, datatypeUnionSerializer.deserialize(buf1, blobs1));

		const { buffer: buf2, blobs: blobs2 } = datatypeUnionSerializer.serialize(new Vector2(4, 5));
		const offset = datatypeUnionSerializer.deserialize(buf2, blobs2);
		Assert.true(typeIs(offset, "Vector2"));
		Assert.fuzzyEqual(5, (offset as Vector2).Y, 0.001);

		const { buffer: buf3, blobs: blobs3 } = datatypeUnionSerializer.serialize(new CFrame(1, 2, 3));
		const placement = datatypeUnionSerializer.deserialize(buf3, blobs3);
		Assert.true(typeIs(placement, "CFrame"));
		Assert.fuzzyEqual(3, (placement as CFrame).Position.Z, 0.001);
	}

	@Fact
	public roundTripsARecursiveTypeAsAUnionMember(): void {
		const value: Chain = { label: "a", next: { label: "b", next: "end" } };
		const { buffer, blobs } = chainSerializer.serialize(value);
		const result = chainSerializer.deserialize(buffer, blobs);
		const nextLink = result.next;
		Assert.true(typeIs(nextLink, "table"));
		if (typeIs(nextLink, "table")) {
			Assert.equal("b", nextLink.label);
			Assert.equal("end", nextLink.next);
		}
	}

	@Fact
	public roundTripsAReAliasedPacked(): void {
		const value: PackedPair = { first: true, second: false };
		const { buffer: buf, blobs } = packedPairSerializer.serialize(value);
		// One byte: both booleans packed, and no presence byte for the brand property.
		Assert.equal(1, buffer.len(buf));
		const result = packedPairSerializer.deserialize(buf, blobs);
		Assert.true(result.first);
		Assert.false(result.second);
	}

	@Fact
	public roundTripsAnObjectWiderThanTheLocalRegisterLimit(): void {
		const fields = {} as Record<string, number>;
		for (const i of $range(0, WIDE_FIELD_COUNT - 1)) {
			fields[string.format("f%03d", i)] = i;
		}
		const { buffer: buf, blobs } = wideSerializer.serialize(fields as Wide);
		Assert.equal(WIDE_FIELD_COUNT * 8, buffer.len(buf));
		const result = wideSerializer.deserialize(buf, blobs) as Record<string, number>;
		for (const i of $range(0, WIDE_FIELD_COUNT - 1)) {
			Assert.equal(i, result[string.format("f%03d", i)]);
		}
	}

	@Fact
	public leavesAUserDeclarationNamedAfterAnInjectedImportAlone(): void {
		Assert.equal("the user's own alloc", alloc());
	}
}

export = CoverageTest;
