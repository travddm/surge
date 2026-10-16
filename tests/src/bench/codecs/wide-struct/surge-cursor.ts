//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { WideStruct } from "./shapes";

export const cursorSerializer = createCursorCodec<WideStruct>();
