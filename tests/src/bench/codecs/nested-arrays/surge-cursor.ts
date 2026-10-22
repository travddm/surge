//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { NestedArrays } from "./shapes";

export const cursorSerializer = createCursorCodec<NestedArrays>();
