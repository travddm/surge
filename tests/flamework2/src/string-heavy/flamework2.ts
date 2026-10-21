//!native
//!optimize 2
import { Flamework } from "@flamework-experimental/core";

interface StringHeavy {
	title: string;
	author: string;
	lines: string[];
}

export const flamework2Serializer = Flamework.createSerializer<StringHeavy>();
