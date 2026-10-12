//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { TaggedUnion } from "./shapes";

export const cursorSerializer = createCursorCodec<TaggedUnion>();
