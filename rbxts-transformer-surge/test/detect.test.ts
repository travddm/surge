import * as ts from "typescript";

import { getDataTypeBrand, getSurgeBrand, resolveFactoryName } from "../src/detect";
import { createFixtureProgram, findDeclaration } from "./harness";

/** Resolves the `ts.CallExpression` of the (assumed unique) top-level call statement named `callName`. */
function findCall(sourceFile: ts.SourceFile, callName: string): ts.CallExpression {
	let found: ts.CallExpression | undefined;
	const visit = (node: ts.Node): void => {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === callName) {
			found = node;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	if (!found) {
		throw new Error(`call to '${callName}' not found in test source`);
	}
	return found;
}

describe("@rbxts/surge in a fixture program", () => {
	// The suites compile surge's own `src/` under this package's `@rbxts/types` and the harness's
	// options, not surge's. An error there would make a brand or `Serialized<T>` an error type, and
	// a test that expects detection to find nothing would still pass.
	test("surge's source compiles with no diagnostics", () => {
		const { program, cleanup } = createFixtureProgram(
			`import { createCodec } from "@rbxts/surge";
			import { grow } from "@rbxts/surge/abi";
			export { createCodec, grow };`,
			{ surge: true },
		);
		try {
			const messages = ts
				.getPreEmitDiagnostics(program)
				.map(
					(diagnostic) =>
						`${diagnostic.file?.fileName}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
				);
			expect(messages).toEqual([]);
		} finally {
			cleanup();
		}
	});
});

describe("resolveFactoryName", () => {
	test("resolves a direct call to createSerializer from @rbxts/surge", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { createSerializer } from "@rbxts/surge"; createSerializer<number>();`,
			{ surge: true },
		);
		try {
			const call = findCall(sourceFile, "createSerializer");
			expect(resolveFactoryName(ts, checker, call.expression)).toBe("createSerializer");
		} finally {
			cleanup();
		}
	});

	test("follows a re-export/alias through to the real declaration", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { createCodec as make } from "@rbxts/surge"; make<number>();`,
			{ surge: true },
		);
		try {
			const call = findCall(sourceFile, "make");
			expect(resolveFactoryName(ts, checker, call.expression)).toBe("createCodec");
		} finally {
			cleanup();
		}
	});

	test("rejects a same-named local declaration that isn't from @rbxts/surge", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`function createSerializer<T>(): void {} createSerializer<number>();`,
			{ surge: true },
		);
		try {
			const call = findCall(sourceFile, "createSerializer");
			expect(resolveFactoryName(ts, checker, call.expression)).toBeUndefined();
		} finally {
			cleanup();
		}
	});
});

describe("getDataTypeBrand / getSurgeBrand", () => {
	test("identifies a DataType.* brand by alias identity", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; interface T { n: DataType.u16; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("n")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			expect(getDataTypeBrand(propType)).toBe("u16");
		} finally {
			cleanup();
		}
	});

	test("a structurally identical brand-shaped type outside @rbxts/surge is not detected", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`type FakeU16 = number & { readonly _surge_u16?: never }; interface T { n: FakeU16; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("n")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			expect(getDataTypeBrand(propType)).toBeUndefined();
		} finally {
			cleanup();
		}
	});

	test("unwraps Packed<T> to its inner type", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; interface Inner { a: boolean; } interface T { p: DataType.Packed<Inner>; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			const brand = getSurgeBrand(checker, propType);
			expect(brand?.name).toBe("Packed");
			expect(checker.typeToString(brand!.args[0])).toBe("Inner");
		} finally {
			cleanup();
		}
	});

	// A re-alias carries its own `aliasSymbol`, so alias identity alone misses
	// it; the `_surge_packed` brand property still identifies it.
	test("unwraps a re-aliased Packed<T> to its inner type", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; interface Inner { a: boolean; } type PackedInner = DataType.Packed<Inner>; interface T { p: PackedInner; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			const brand = getSurgeBrand(checker, propType);
			expect(brand?.name).toBe("Packed");
			expect(checker.typeToString(brand!.args[0])).toBe("Inner");
		} finally {
			cleanup();
		}
	});

	test("a _surge_packed property declared outside @rbxts/surge is not detected", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`interface Inner { a: boolean; } type Fake = Inner & { readonly _surge_packed?: [Inner] }; interface T { p: Fake; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			expect(getSurgeBrand(checker, propType)).toBeUndefined();
		} finally {
			cleanup();
		}
	});

	test("reads Length<T, L>'s two type arguments", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; interface T { p: DataType.Length<Array<string>, DataType.u16>; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			const brand = getSurgeBrand(checker, propType);
			expect(brand?.name).toBe("Length");
			expect(getDataTypeBrand(brand!.args[1])).toBe("u16");
		} finally {
			cleanup();
		}
	});

	test("a _surge_length property declared outside @rbxts/surge is not detected", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`type Fake = string[] & { readonly _surge_length?: [string[], number] }; interface T { p: Fake; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			expect(getSurgeBrand(checker, propType)).toBeUndefined();
		} finally {
			cleanup();
		}
	});

	// A composition flattens into an intersection carrying both brand
	// properties, so a `_surge_packed` check that ran before alias identity
	// would answer "Packed" here and drop the length with no error.
	test("Length<Packed<T>, L> resolves outermost-first, not by brand property", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; interface Inner { a: boolean; } interface T { p: DataType.Length<DataType.Packed<Array<Inner>>, DataType.u16>; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			// The premise: the composition flattens, so both brand properties
			// are on the one type and only the alias says which is outermost.
			expect(propType.getProperty("_surge_packed")).toBeDefined();
			expect(propType.getProperty("_surge_length")).toBeDefined();
			expect(getSurgeBrand(checker, propType)?.name).toBe("Length");
		} finally {
			cleanup();
		}
	});

	// A re-alias has no brand alias left, so both brand properties are all
	// there is to go on. The outer brand recorded the whole inner brand and
	// still carries its property; the inner one recorded its arguments before
	// the outer was applied.
	test("a re-aliased Length<Packed<T>, L> resolves to Length", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; interface Inner { a: boolean; } type Bounded = DataType.Length<DataType.Packed<Array<Inner>>, DataType.u16>; interface T { p: Bounded; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			expect(getSurgeBrand(checker, propType)?.name).toBe("Length");
		} finally {
			cleanup();
		}
	});

	test("a re-aliased Packed<Length<T, L>> resolves to Packed", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; interface Inner { a: boolean; } type PackedBounded = DataType.Packed<DataType.Length<Array<Inner>, DataType.u16>>; interface T { p: PackedBounded; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			expect(getSurgeBrand(checker, propType)?.name).toBe("Packed");
		} finally {
			cleanup();
		}
	});

	/**
	 * The brand `getSurgeBrand` finds on property `p` of `T`, declared by
	 * `source`, with each argument as the width brand it names or as the
	 * checker prints it.
	 */
	function brandOfP(source: string): { name: string | undefined; args: string[] } {
		const { checker, sourceFile, cleanup } = createFixtureProgram(source, { surge: true });
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const brand = getSurgeBrand(checker, checker.getTypeOfSymbolAtLocation(prop, declarationNode));
			return {
				name: brand?.name,
				args: (brand?.args ?? []).map((arg) => getDataTypeBrand(arg) ?? checker.typeToString(arg)),
			};
		} finally {
			cleanup();
		}
	}

	test("reads Range<T, Min, Max>'s three type arguments, aliased and re-aliased", () => {
		const expected = { name: "Range", args: ["u8", "0", "100"] };
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; interface T { p: DataType.Range<DataType.u8, 0, 100>; }`,
			),
		).toEqual(expected);
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; type Health = DataType.Range<DataType.u8, 0, 100>; interface T { p: Health; }`,
			),
		).toEqual(expected);
	});

	test("reads Exact<T, N>'s two type arguments, aliased and re-aliased", () => {
		const expected = { name: "Exact", args: ["string", "4"] };
		expect(
			brandOfP(`import { DataType } from "@rbxts/surge"; interface T { p: DataType.Exact<string, 4>; }`),
		).toEqual(expected);
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; type Code = DataType.Exact<string, 4>; interface T { p: Code; }`,
			),
		).toEqual(expected);
	});

	// A brand applied twice carries its property twice, and the two records
	// intersect. The outer one recorded the whole inner type, which carries
	// every other record.
	test("a re-aliased brand applied more than once resolves to its outer application", () => {
		const ids = `import { DataType } from "@rbxts/surge"; type Ids = DataType.Length<string[], DataType.u8>;`;
		expect(brandOfP(`${ids} type Ids16 = DataType.Length<Ids, DataType.u16>; interface T { p: Ids16; }`)).toEqual({
			name: "Length",
			args: ["Ids", "u16"],
		});
		expect(
			brandOfP(
				`${ids} type Ids16 = DataType.Length<Ids, DataType.u16>; type Ids32 = DataType.Length<Ids16, DataType.u32>; interface T { p: Ids32; }`,
			),
		).toEqual({ name: "Length", args: ["Ids16", "u32"] });
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; type Code = DataType.Exact<DataType.Exact<string, 3>, 4>; interface T { p: Code; }`,
			),
		).toMatchObject({ name: "Exact", args: [expect.anything(), "4"] });
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; type Q = DataType.Quantized<DataType.Quantized<CFrame>>; interface T { p: Q; }`,
			),
		).toMatchObject({ name: "Quantized" });
	});

	// A test for the inner brand's property alone would pass the inner
	// `Length` here, since its inner type carries an `Exact` too.
	test("a re-aliased chain that repeats a brand around another resolves to its outer application", () => {
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; type A = DataType.Exact<string[], 2>; type B = DataType.Length<A, DataType.u8>; type C = DataType.Exact<B, 3>; interface T { p: C; }`,
			),
		).toEqual({ name: "Exact", args: ["B", "3"] });
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; interface X { b: boolean; } type L = DataType.Length<DataType.Packed<DataType.Length<X[], DataType.u8>>, DataType.u16>; interface T { p: L; }`,
			),
		).toMatchObject({ name: "Length", args: [expect.anything(), "u16"] });
	});

	test("two applications of a brand where neither wraps the other have no outermost one", () => {
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; interface T { p: DataType.Vector<DataType.i16> & DataType.Vector<DataType.u8>; }`,
			).name,
		).toBeUndefined();
	});

	// The width brand's property is on the same intersection as the range's,
	// and it is the inner brand, so reading it first would drop the range.
	test("a re-aliased Range over a width brand is not read as the width", () => {
		const { checker, sourceFile, cleanup } = createFixtureProgram(
			`import { DataType } from "@rbxts/surge"; type Health = DataType.Range<DataType.u8, 0, 100>; interface T { p: Health; }`,
			{ surge: true },
		);
		try {
			const declarationNode = findDeclaration(sourceFile, "T");
			const prop = checker.getTypeAtLocation(declarationNode).getProperty("p")!;
			const propType = checker.getTypeOfSymbolAtLocation(prop, declarationNode);
			expect(propType.getProperty("_surge_u8")).toBeDefined();
			expect(getSurgeBrand(checker, propType)?.name).toBe("Range");
		} finally {
			cleanup();
		}
	});

	test("a re-aliased Quantized<Transform<X>> resolves to Quantized", () => {
		expect(
			brandOfP(
				`import { DataType } from "@rbxts/surge"; type Placement = DataType.Quantized<DataType.Transform<DataType.i16>>; interface T { p: Placement; }`,
			).name,
		).toBe("Quantized");
	});
});
