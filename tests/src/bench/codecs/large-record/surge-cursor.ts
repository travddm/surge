//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { LargeRecord } from "./shapes";

export const cursorSerializer = createCursorCodec<LargeRecord>();
