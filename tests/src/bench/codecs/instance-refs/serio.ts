//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioInstanceRefs } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioInstanceRefs>();
