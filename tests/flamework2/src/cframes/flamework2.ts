//!native
//!optimize 2
import { Flamework } from "@flamework-experimental/core";

interface Transforms {
	list: CFrame[];
}

export const flamework2Serializer = Flamework.createSerializer<Transforms>();
