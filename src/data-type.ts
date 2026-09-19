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
	 * Opts a subtree into bit-packing: `boolean`/`optional` fields inside
	 * collapse to 1 bit each instead of the default byte-aligned encoding
	 * (see Type Coverage -> Packed<T> in transformer.md).
	 */
	export type Packed<T> = T & { readonly _surge_packed?: [T] };
}
