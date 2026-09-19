import { Assert, Fact } from "@rbxts/runit";
import { DataType, createBinarySerializer } from "@rbxts/surge";

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

// blob-classification.md: a Roblox datatype with no dedicated scalar-kind
// encoding (unlike Vector3/CFrame/Color3 above) must still round-trip, via
// its `_nominal_Vector2` brand routing it to the blob passthrough channel
// instead of being walked structurally.
interface WithUnencodedDatatype {
	offset: Vector2;
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

// walk-type-identity.md: two instantiations of one generic interface must
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

// recursive-union-types.md: a recursive discriminated union used to crash
// the whole `rbxtsc` build with an uncaught stack overflow instead of
// compiling to a recursion helper.
type Expr = { kind: "num"; v: number } | { kind: "add"; l: Expr; r: Expr };
const exprSerializer = createBinarySerializer<Expr>();

// enum-encoding.md's `Enum.KeyCode` width/O(1)-table fixture intentionally
// does not live here: the generated `{[EnumItem]: index}`/`EnumItem[]`
// tables are module constants built from *every* member up front (matching
// real Roblox and Transformer Design's own "How, briefly"), and this
// suite's headless Lune harness (see testing.md) doesn't implement every
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
		const result = collectionsSerializer.deserialize(buffer, blobs);
		Assert.equal(value.items.size(), result.items.size());
		Assert.equal(value.pair[1], result.pair[1]);
		Assert.equal(value.record.x, result.record.x);
		Assert.equal(value.map.get("k"), result.map.get("k"));
		Assert.true(result.set.has("p"));
	}

	@Fact
	public roundTripsRobloxTypes(): void {
		const value: WithRobloxTypes = {
			position: new Vector3(1, 2, 3),
			orientation: new CFrame(1, 2, 3),
			tint: new Color3(0.5, 0.25, 0.75),
			rig: Enum.HumanoidRigType.R15,
		};
		const { buffer, blobs } = robloxSerializer.serialize(value);
		const result = robloxSerializer.deserialize(buffer, blobs);
		Assert.fuzzyEqual(value.position.X, result.position.X, 0.001);
		Assert.equal(value.rig, result.rig);
	}

	@Fact
	public roundTripsUnencodedDatatypeAsAnOpaqueBlob(): void {
		const value: WithUnencodedDatatype = { offset: new Vector2(4, 5) };
		const { buffer: buf, blobs } = unencodedDatatypeSerializer.serialize(value);
		// Nothing is written into the buffer for a blob field -- this is the
		// whole point of the passthrough channel, and a real byte-size
		// assertion (not just round-trip equality) is what would have caught
		// the walker recursing into Vector2's declared properties instead.
		Assert.equal(0, buffer.len(buf));
		const result = unencodedDatatypeSerializer.deserialize(buf, blobs);
		Assert.equal(value.offset, result.offset);
	}

	@Fact
	public roundTripsTaggedUnion(): void {
		const value: Shape = { kind: "rect", width: 2, height: 3 };
		const { buffer, blobs } = shapeSerializer.serialize(value);
		const result = shapeSerializer.deserialize(buffer, blobs);
		Assert.equal(value.kind, result.kind);
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
		// Regression for wire-format-determinism.md: the packed byte is now
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
}

export = CoverageTest;
