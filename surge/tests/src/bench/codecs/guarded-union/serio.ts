//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioGuardedUnion } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioGuardedUnion>();
