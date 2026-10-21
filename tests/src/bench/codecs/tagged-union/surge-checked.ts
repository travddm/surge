//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { TaggedUnion } from "./shapes";

export const checkedSerializer = createCodec<TaggedUnion>({ readChecks: true });
