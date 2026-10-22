//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Readings } from "./shapes";

export const cursorSerializer = createCursorCodec<Readings>();
