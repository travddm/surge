//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { StringHeavy } from "./shapes";

export const cursorSerializer = createCursorCodec<StringHeavy>();
