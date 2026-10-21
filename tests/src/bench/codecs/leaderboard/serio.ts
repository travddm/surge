//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioLeaderboard } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioLeaderboard>();
