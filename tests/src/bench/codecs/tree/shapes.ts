import type { DataType } from "@rbxts/surge";

/**
 * A type that refers to itself, so surge writes and reads it through a
 * recursion helper rather than inline. Only surge and the baseline have a
 * cell. fbs and serio cannot declare it: Flamework, which generates both
 * their schemas, overflows its stack on the self-reference. Blink's compiler
 * rejects the self-reference, and Zap compiles it as an opaque value passed
 * beside the bytes, so the children would not be in the buffer at all.
 */
export interface TreeNode {
	id: DataType.u16;
	children: TreeNode[];
}
