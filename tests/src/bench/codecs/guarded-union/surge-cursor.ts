//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { GuardedUnion } from "./shapes";

export const cursorSerializer = createCursorCodec<GuardedUnion>();
