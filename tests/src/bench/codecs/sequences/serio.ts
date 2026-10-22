//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { Effects } from "./shapes";

export const serioSerializer = createSerioSerializer<Effects>();
