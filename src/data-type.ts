//!optimize 2
/**
 * Branded number types the transformer recognizes as an explicit width
 * request, matching fbs's own `DataType.*` branding convention (see Wire format
 * 4.1 in docs/specs/wire-format.md) so existing fbs call sites migrate with only
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
	 * Sets how `T`'s encoding says how much follows. Applies to a `string`,
	 * an array, a `Map`, a `Set`, a `Record`, a `buffer`, and a tuple's rest
	 * element; on anything else the transformer reports a diagnostic.
	 *
	 * With a width — {@link u8}, {@link u16}, {@link u24}, or {@link u32} —
	 * a count of that width is written ahead of the contents. The default is
	 * `u32`, which is what an unbranded container writes, so `Length<T>` and
	 * `T` encode identically. A narrower width saves the difference on every
	 * value and truncates silently above what it can count, so it states a
	 * bound the shape is known to keep.
	 *
	 * With a whole number literal (`Length<string, 8>`) no count is written
	 * at all and both sides use exactly that many bytes or elements. The
	 * value must have exactly that many: a longer one is truncated, and a
	 * shorter one raises wherever writing the missing part touches it. The
	 * one exception is an array or tuple rest whose element is optional,
	 * where the missing elements are written as absent and the value comes
	 * back at its own length. Nothing checks any of this until write-side
	 * validation exists, so use the exact form only where the length is
	 * fixed by construction. A `Map`, `Set`, or `Record` cannot take it —
	 * the write side counts entries as it iterates them, so it cannot
	 * promise a fixed number.
	 *
	 * Unlike {@link Packed}, this applies to the container it wraps and not
	 * to the subtree under it: in `Length<Array<Array<string>>, u16>` the
	 * outer array takes the u16 count and the inner ones keep `u32`.
	 */
	export type Length<T, L extends u8 | u16 | u24 | u32 = u32> = T & { readonly _surge_length?: [T, L] };

	/** Every width brand above, and the constraint a per-component width takes. */
	type Width = f32 | f64 | u8 | u16 | u24 | u32 | i8 | i16 | i24 | i32;

	/**
	 * Stores a `Vector3`'s three components at the given widths instead of
	 * three {@link f32}s. `Y` and `Z` default to `X`, and `X` to {@link f32},
	 * so an all-default `Vector` and a `Vector3` produce the same bytes.
	 *
	 * An integer width truncates a component toward zero and wraps it modulo
	 * its range. Nothing raises and nothing checks the value until write-side
	 * validation exists, so a width states a range the shape is known to keep.
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
	 * Opts a subtree into the smaller encodings. As a direct property of an
	 * object inside it, a `boolean`, an `optional`'s presence, and the tag of
	 * a two-variant tagged union are 1 bit each, not 1 byte. A `CFrame`
	 * anywhere inside it is 1 byte when its rotation is axis-aligned and its
	 * position is zero or one, 13 bytes with one of the two, and 25 bytes
	 * (1 more than outside) with neither, and {@link Transform} does not
	 * apply to it. See section 8 of docs/specs/wire-format.md.
	 */
	export type Packed<T> = T & { readonly _surge_packed?: [T] };
}
