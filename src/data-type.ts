//!optimize 2
/**
 * Branded number types the transformer recognizes as an explicit width
 * request, matching fbs's own `DataType.*` branding convention (see Type
 * Coverage in transformer.md) so existing fbs call sites migrate with only
 * an import-path change. A plain `number` with no brand defaults to `f64`.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace -- a namespace is the only way to get fbs's exact `DataType.f32` dotted-type-reference syntax.
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
	 * Sets the width of the count `T`'s encoding writes ahead of its
	 * contents. Applies to a `string`, an array, a `Map`, a `Set`, a
	 * `Record`, a `buffer`, and a tuple's rest element; on anything else the
	 * transformer reports a diagnostic. `L` must be one of {@link u8},
	 * {@link u16}, {@link u24}, or {@link u32}.
	 *
	 * The default is `u32`, which is what an unbranded container writes, so
	 * `Length<T>` and `T` encode identically. A narrower width saves the
	 * difference on every value and truncates silently above what it can
	 * count, so it states a bound the shape is known to keep.
	 *
	 * Unlike {@link Packed}, this applies to the container it wraps and not
	 * to the subtree under it: in `Length<Array<Array<string>>, u16>` the
	 * outer array takes the u16 count and the inner ones keep `u32`.
	 */
	export type Length<T, L extends u8 | u16 | u24 | u32 = u32> = T & { readonly _surge_length?: [T, L] };

	/**
	 * Opts a subtree into the smaller encodings. As a direct property of an
	 * object inside it, a `boolean`, an `optional`'s presence, and the tag of
	 * a two-variant tagged union are 1 bit each, not 1 byte. A `CFrame`
	 * anywhere inside it is 1 byte when its rotation is axis-aligned and its
	 * position is zero or one, 13 bytes with one of the two, and 25 bytes
	 * (1 more than outside) with neither. See Type Coverage -> Packed<T> in
	 * transformer.md.
	 */
	export type Packed<T> = T & { readonly _surge_packed?: [T] };
}
