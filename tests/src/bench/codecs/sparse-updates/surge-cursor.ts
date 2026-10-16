//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Updates } from "./shapes";

export const cursorSerializer = createCursorCodec<Updates>();
