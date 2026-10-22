//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Effects } from "./shapes";

export const cursorSerializer = createCursorCodec<Effects>();
