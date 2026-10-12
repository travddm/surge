//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { NestedObject } from "./shapes";

export const cursorSerializer = createCursorCodec<NestedObject>();
