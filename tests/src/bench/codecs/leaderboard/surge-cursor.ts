//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Leaderboard } from "./shapes";

export const cursorSerializer = createCursorCodec<Leaderboard>();
