//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Samples } from "./shapes";

export const cursorSerializer = createCursorCodec<Samples>();
