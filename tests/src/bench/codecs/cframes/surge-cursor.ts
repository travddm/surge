//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Transforms } from "./shapes";

export const cursorSerializer = createCursorCodec<Transforms>();
