//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { EnumHeavy } from "./shapes";

export const cursorSerializer = createCursorCodec<EnumHeavy>();
