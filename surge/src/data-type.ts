//!optimize 2
/**
 * Branded number types the transformer recognizes as an explicit width
 * request, spelled as fbs spells its own (`DataType.u8`; see Wire format 4.1 in
 * docs/specs/wire-format.md). A plain `number` with no brand defaults to `f64`.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace -- a namespace is the only way to get the dotted `DataType.f32` type reference.
export namespace DataType {
	export type f32 = number & { readonly _surge_f32?: never };
	export type f64 = number & { readonly _surge_f64?: never };
	export type u8 = number & { readonly _surge_u8?: never };
	export type u16 = number & { readonly _surge_u16?: never };
	/** 3 bytes. Luau's `buffer` has no 24-bit calls, so this costs two writes and two reads. */
	export type u24 = number & { readonly _surge_u24?: never };
	export type u32 = number & { readonly _surge_u32?: never };
	export type i8 = number & { readonly _surge_i8?: never };
	export type i16 = number & { readonly _surge_i16?: never };
	/** 3 bytes, two's complement. See {@link u24}. */
	export type i24 = number & { readonly _surge_i24?: never };
	export type i32 = number & { readonly _surge_i32?: never };

	/**
	 * Sets the width of the count `T` writes ahead of its contents. Applies to
	 * a `string`, an array, a `Map`, a `Set`, a `Record`, a `buffer`, and a
	 * tuple's rest element; on anything else the transformer reports a
	 * diagnostic. `L` is {@link u8}, {@link u16}, {@link u24} or {@link u32},
	 * as in `Length<string[], DataType.u8>`. Without `Length`, the count is
	 * variable-length: one byte below 254, three up to 65535, and five above
	 * (Wire format 6.9 in docs/specs/wire-format.md).
	 *
	 * Above what it can count, the count wraps unless `writeChecks` is on,
	 * which raises instead (Wire format 6.8), so a width states a bound the
	 * shape is known to keep. A number literal satisfies the constraint, since
	 * a width brand is a `number`, but the transformer reports it: a length
	 * fixed with no count is {@link Exact}.
	 *
	 * Unlike {@link Packed}, this applies to the container it wraps and not
	 * to the subtree under it: in `Length<Array<Array<string>>, u16>` the
	 * outer array takes the u16 count and the inner ones keep the
	 * variable-length count. Around a `T` that already has a `Length` or an
	 * {@link Exact}, it replaces that count (Transformer 4.17 in
	 * docs/specs/transformer.md).
	 *
	 * @typeParam T the container whose count this sets
	 * @typeParam L the count's width
	 */
	export type Length<T, L extends u8 | u16 | u24 | u32> = T & { readonly _surge_length?: [T, L] };

	/**
	 * Fixes `T`'s length at `N` and writes no count: both sides use exactly
	 * `N` bytes or elements (Wire format 6.3 in docs/specs/wire-format.md), as
	 * in `Exact<string, 8>`. `N` is a whole number literal. Applies to a
	 * `string`, an array, a `buffer`, and a tuple's rest element; on anything
	 * else the transformer reports a diagnostic. A `Map`, `Set`, or `Record`
	 * cannot take it — the write side counts entries as it iterates them, so
	 * it cannot promise a fixed number.
	 *
	 * The value must have exactly `N`, and only `writeChecks` checks it
	 * (Runtime API 3.10 in docs/specs/runtime-api.md). Without it, a longer
	 * one is truncated. A shorter string or buffer raises. A shorter array or
	 * tuple rest writes each missing element as `nil` (Wire format 6.6 and
	 * 6.7 in docs/specs/wire-format.md):
	 *
	 * - an optional element, or a literal union that includes `undefined`,
	 *   is written as absent, and the value comes back at its own length;
	 * - a `boolean` comes back as `false`, a literal union as its last value
	 *   in canonical literal order, and a single literal as itself, each at
	 *   the full length, without raising;
	 * - a blob appends nothing, so `deserialize` raises past the end of the
	 *   blobs;
	 * - any other element raises, except those Wire format 6.7 lists.
	 *
	 * So use `Exact` only where the length is fixed by construction. Like
	 * {@link Length}, it applies to the container it wraps and not to the
	 * subtree under it, and around a `T` that already has a `Length` or an
	 * `Exact`, it replaces that count.
	 *
	 * @typeParam T the container whose length this fixes
	 * @typeParam N the length, a whole number literal
	 */
	export type Exact<T, N extends number> = T & { readonly _surge_exact?: [T, N] };

	/**
	 * Every width brand above: the constraint a per-component width takes, and
	 * one a type over widths can take, as in `Sample<W extends DataType.Width>`.
	 * A property typed `Width` itself is a diagnostic, since it names no width.
	 */
	export type Width = f32 | f64 | u8 | u16 | u24 | u32 | i8 | i16 | i24 | i32;

	/**
	 * States the values a number takes: from `Min` to `Max`, both number
	 * literals. `W` is `number`, the default, or one of the width brands
	 * above; the transformer reports anything else, since every width brand is
	 * a `number` and the constraint can say no more.
	 *
	 * With `number`, the value is a whole number, stored at the narrowest width
	 * that holds the range: {@link u8}, {@link u16}, {@link u24} or
	 * {@link u32} when `Min` is not negative, {@link i8} to {@link i32}
	 * otherwise, and {@link f64} past 32 bits. `Range<0, 100>` is one byte.
	 * With a width brand, as in `Range<0, 100, DataType.u16>`, that width is
	 * kept, and a range it cannot hold is a diagnostic; {@link f32} and
	 * {@link f64} also admit fractions.
	 *
	 * The range changes no byte beyond the width. With `writeChecks`,
	 * `serialize` raises for a value outside the range, a NaN, and a fraction
	 * where the range holds whole numbers. Without it, nothing checks the
	 * value, and one outside the width wraps as that width does.
	 *
	 * @typeParam Min the lowest value, a number literal
	 * @typeParam Max the highest value, a number literal
	 * @typeParam W the width: `number` for the narrowest, or a width brand
	 */
	export type Range<Min extends number, Max extends number, W extends number = number> = number & {
		readonly _surge_range?: [Min, Max, W];
	};

	/**
	 * Stores a `Vector3`'s three components at the given widths instead of
	 * three {@link f32}s. `Y` and `Z` default to `X`, and `X` to {@link f32},
	 * so an all-default `Vector` and a `Vector3` produce the same bytes.
	 *
	 * An integer width truncates a component toward zero and wraps it modulo
	 * its range. With `writeChecks`, a component the width cannot hold raises
	 * instead (Runtime API 3.10 in docs/specs/runtime-api.md).
	 */
	export type Vector<X extends Width = f32, Y extends Width = X, Z extends Width = X> = Vector3 & {
		readonly _surge_vector?: [X, Y, Z];
	};

	/**
	 * Stores a `CFrame`'s position at the given widths, exactly as
	 * {@link Vector} does for a `Vector3`. The rotation is unchanged: it stays
	 * an f32 axis-angle triple.
	 *
	 * Has no form inside {@link Packed}, whose `CFrame` writes its position
	 * through a runtime function with a layout of its own; a width other than
	 * the default there is a diagnostic.
	 */
	export type Transform<X extends Width = f32, Y extends Width = X, Z extends Width = X> = CFrame & {
		readonly _surge_transform?: [X, Y, Z];
	};

	/**
	 * Stores a `CFrame`'s rotation in 6 bytes instead of 12: each component of
	 * its axis-angle vector as an {@link i16}, rounded. The rotation that
	 * comes back is within about 1e-4 radians of the one written, so use it
	 * only where that loss is acceptable. `T` may be a {@link Transform}, which
	 * still sets the position's widths. Has no form inside {@link Packed}, and
	 * is a diagnostic there. See Wire format 7.4 in docs/specs/wire-format.md.
	 */
	export type Quantized<T extends CFrame> = T & { readonly _surge_quantized?: [T] };

	/**
	 * Opts a subtree into the smaller encodings. As a direct property of an
	 * object inside it, a `boolean`, an `optional`'s presence, and the tag of
	 * a two-variant tagged union are 1 bit each, not 1 byte. A `Set` of
	 * literal values anywhere inside it is one bit per value it can hold, with
	 * no count. A `CFrame` anywhere inside it is 1 byte when its rotation is
	 * axis-aligned and its position is zero or one, 13 bytes with one of the
	 * two, and 25 bytes (1 more than outside) with neither, and
	 * {@link Transform} and {@link Quantized} do not apply to it. See section 8
	 * of docs/specs/wire-format.md.
	 */
	export type Packed<T> = T & { readonly _surge_packed?: [T] };
}
