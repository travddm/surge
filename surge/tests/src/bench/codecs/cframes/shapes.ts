/**
 * No width brands, so the unpacked shape is the same for all three; only the
 * `Packed<T>` wrapper comes from each library's own namespace. serio stores a
 * rotation quantized to about 0.05 radians per component, so its round trip
 * is inexact by design on every row here -- see the coverage matrix in
 * docs/research/type-coverage-across-libraries.md.
 *
 * Neither packed row has a Zap cell: it has no packed mode, and its
 * `AlignedCFrame`, which would answer the axis-aligned one, looks a rotation
 * up by exact equality in a table built from `CFrame.Angles`, the same table
 * fbs and serio miss on these rotations, and Zap asserts on a miss instead of
 * falling back to a general form.
 */
export interface Transforms {
	list: CFrame[];
}
