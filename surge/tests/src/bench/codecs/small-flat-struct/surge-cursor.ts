//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { SmallFlatStruct } from "./shapes";

export const cursorSerializer = createCursorCodec<SmallFlatStruct>();
