//!native
//!optimize 2
import { Flamework } from "@flamework-experimental/core";

interface Element {
	offset: Vector2;
	tint: Color3;
	size: UDim2;
}

interface Layout {
	elements: Element[];
}

export const flamework2Serializer = Flamework.createSerializer<Layout>();
