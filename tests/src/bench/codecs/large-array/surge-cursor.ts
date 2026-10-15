//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { LargeArray } from "./shapes";

export const cursorSerializer = createCursorCodec<LargeArray>();
