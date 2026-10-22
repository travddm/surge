//!native
//!optimize 2
import { Flamework } from "@flamework-experimental/core";

interface Effect {
	color: ColorSequence;
	size: NumberSequence;
}

interface Effects {
	effects: Effect[];
}

export const flamework2Serializer = Flamework.createSerializer<Effects>();
