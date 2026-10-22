//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { IdSet } from "./shapes";

export const cursorSerializer = createCursorCodec<IdSet>();
