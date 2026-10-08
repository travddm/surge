//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Leaderboard } from "./shapes";

export const serializer = createCodec<Leaderboard>();
