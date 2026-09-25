//!optimize 2
/**
 * The Roblox types surge writes into the buffer (Transformer 4.1 in
 * docs/specs/transformer.md). Each carries a `_nominal_*` property, as the
 * Roblox types surge passes through as blobs do, so they are matched first.
 * An enum item carries none, and is matched here before its members are.
 */
type EncodedRobloxType =
	| Vector2
	| Vector3
	| CFrame
	| Color3
	| ColorSequence
	| NumberSequence
	| Vector3int16
	| UDim
	| UDim2
	| BrickColor
	| NumberRange
	| Rect
	| DateTime
	| EnumItem;

/** A property name that is not one of `DataType`'s brand markers. */
type FieldKey<T> = Exclude<keyof T, `_surge_${string}`>;

/**
 * The properties `T` has beyond the Roblox type it extends. The transformer
 * encodes that type only as itself or under a `DataType` brand, and passes
 * one with other properties, such as `Vector3 & { tag: 1 }`, through as a blob.
 */
type ExtraKeys<T> = EncodedRobloxType extends infer R
	? R extends unknown
		? T extends R
			? Exclude<FieldKey<T>, keyof R>
			: never
		: never
	: never;

/** Whether `A` and `B` are the same type, not only assignable to each other. */
type Same<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

/** Whether `T` is one of the types in `Seen`. */
type Includes<Seen extends unknown[], T> = Seen extends [infer Head, ...infer Rest]
	? Same<Head, T> extends true
		? true
		: Includes<Rest, T>
	: false;

/**
 * `true` when a value of `T` can put anything in `blobs`, and `false` when
 * every part of it is written into the buffer (Runtime API 3.12 in
 * docs/specs/runtime-api.md). It follows the transformer's classification
 * (Transformer 4.1), and is `true` wherever it cannot tell: an empty `blobs`
 * array is a correct result, and a missing one is not. The transformer checks
 * the one direction that matters, and reports a shape whose blob this type
 * misses (Transformer 7.3).
 *
 * `Seen` holds the types being walked on the way down. A recursive type meets
 * itself again, and what it holds is already being walked there, so the
 * second meeting adds nothing.
 */
type MayCarryBlobs<T, Seen extends unknown[] = []> = 0 extends 1 & T
	? true
	: unknown extends T
		? true
		: true extends (T extends unknown ? PartCarriesBlobs<T, Seen> : never)
			? true
			: false;

/** One member of a union, as {@link MayCarryBlobs} classifies it. */
type PartCarriesBlobs<T, Seen extends unknown[]> = T extends string | number | boolean | undefined | void | buffer
	? false
	: T extends EncodedRobloxType
		? [ExtraKeys<T>] extends [never]
			? false
			: true
		: Includes<Seen, T> extends true
			? false
			: T extends ReadonlyArray<infer E>
				? MayCarryBlobs<E, [...Seen, T]>
				: T extends ReadonlyMap<infer K, infer V>
					? MayCarryBlobs<K | V, [...Seen, T]>
					: T extends ReadonlySet<infer E>
						? MayCarryBlobs<E, [...Seen, T]>
						: [Extract<keyof T, `_nominal_${string}`>] extends [never]
							? [FieldKey<T>] extends [never]
								? true
								: true extends { [K in FieldKey<T>]: MayCarryBlobs<T[K], [...Seen, T]> }[FieldKey<T>]
									? true
									: false
							: true;

/**
 * What `serialize` returns: the buffer alone for a `T` that can hold no blob,
 * and otherwise a table of the buffer and `blobs`, the values the buffer
 * cannot carry.
 */
export type Serialized<T> = MayCarryBlobs<T> extends true ? { buffer: buffer; blobs: Array<defined> } : buffer;

/**
 * Writes a value of `T`, and returns its {@link Serialized} form.
 *
 * `in out` states that `T` is invariant, as it is on each of the types
 * here. Stated, the checker does not measure it, and measuring it walks
 * {@link Serialized} with an unknown `T` until it reports the instantiation
 * as too deep.
 */
export type Serializer<in out T> = (value: T) => Serialized<T>;

/** Reads back a value of `T` from what a {@link Serializer} of `T` returned. */
export type Deserializer<in out T> = (input: Serialized<T>) => T;

/**
 * A {@link Deserializer} under {@link CodecOptions.readChecks}: it also takes
 * `unknown`, and raises for anything that is not {@link Serialized}.
 *
 * The first signature is what it expects, and the transformer reads the shape
 * it checks from it. The second takes whatever a remote delivered.
 */
export interface CheckedDeserializer<in out T> {
	(input: Serialized<T>): T;
	(input: unknown): T;
}

/** A {@link Serializer} and a {@link Deserializer} of the same `T`. */
export interface Codec<in out T> {
	serialize: Serializer<T>;
	deserialize: Deserializer<T>;
}

/** A {@link Codec} under {@link CodecOptions.readChecks}. */
export interface CheckedCodec<in out T> {
	serialize: Serializer<T>;
	deserialize: CheckedDeserializer<T>;
}

function notConfigured(): never {
	throw (
		"rbxts-transformer-surge is not registered in this project's tsconfig.json `plugins`. " +
		"createCodec/createSerializer/createDeserializer have no real implementation on " +
		"their own -- the transformer replaces every call to them at compile time."
	);
}

/**
 * Options read at the call site, where they must be written as literals: the
 * transformer decides what to emit from them at compile time.
 */
export interface CodecOptions {
	/**
	 * Check, on every read, that `deserialize` stays inside the input buffer,
	 * and that a count it reads back is one the rest of the input could hold.
	 * A payload that fails either raises a string beginning `@rbxts/surge: `,
	 * so a caller `pcall`s at the boundary. Defaults to `false`.
	 *
	 * `deserialize` then also takes `unknown`, and raises the same way for an
	 * input that is not what `serialize` returns for this type, so what a
	 * remote delivered can be passed to it as it is.
	 *
	 * Turn it on where the server reads what a client sent, since an exploiter
	 * can send anything. The game's own bytes, such as what the server sends a
	 * client or what the game saved to a `DataStore`, do not need it. It costs
	 * a branch per read, and a check of the input's shape per call. It checks lengths, counts, and the
	 * indexes that name an enum item or a packed rotation, and no other value:
	 * a payload that is the right shape but the wrong data still deserializes.
	 */
	readonly readChecks?: boolean;
	/**
	 * Check, on every write, that a value fits its type: that a
	 * `DataType.Length<T, N>` value is exactly `N` long, that a count fits the
	 * width `DataType.Length<T, L>` gives it, and that a number is one its
	 * `DataType.Range<T, Min, Max>` admits. A value that does not raises a
	 * string beginning `@rbxts/surge: ` from `serialize`, where unchecked it
	 * would be padded, truncated, or wrapped. Defaults to `false`.
	 *
	 * It catches a value this game built wrong rather than input it was sent,
	 * so it costs a branch per container and per ranged number, on the write
	 * side only. A type with no narrowed or exact `DataType.Length` and no
	 * `DataType.Range` gets no check, and pays nothing.
	 */
	readonly writeChecks?: boolean;
}

/**
 * Replaced entirely by `rbxts-transformer-surge` at compile time (see
 * Runtime API 3.4 in docs/specs/runtime-api.md). Calling this directly means the
 * transformer isn't registered for this project.
 */
export function createCodec<T>(options: CodecOptions & { readonly readChecks: true }): CheckedCodec<T>;
export function createCodec<T>(options?: CodecOptions): Codec<T>;
export function createCodec<T>(options?: CodecOptions): CheckedCodec<T> {
	return notConfigured();
}

/** See {@link createCodec}. Takes the write side of {@link CodecOptions}. */
export function createSerializer<T>(options?: Pick<CodecOptions, "writeChecks">): Serializer<T> {
	return notConfigured();
}

/** See {@link createCodec}. Takes the read side of {@link CodecOptions}. */
export function createDeserializer<T>(options: { readonly readChecks: true }): CheckedDeserializer<T>;
export function createDeserializer<T>(options?: Pick<CodecOptions, "readChecks">): Deserializer<T>;
export function createDeserializer<T>(options?: Pick<CodecOptions, "readChecks">): CheckedDeserializer<T> {
	return notConfigured();
}
