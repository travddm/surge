/**
 * An array of interface elements, each a `Vector2` offset, a `Color3` tint and
 * a `UDim2` size: the datatypes of a layout, which carry no width brand. fbs
 * and serio pass a type they have no encoding for beside the bytes. serio
 * writes a `UDim`'s offset as a u16, so the sample's offsets are not negative.
 * Blink and Zap have no `UDim2`.
 */
export interface Element {
	offset: Vector2;
	tint: Color3;
	size: UDim2;
}

export interface Layout {
	elements: Element[];
}
