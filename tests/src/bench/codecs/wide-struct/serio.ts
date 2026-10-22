//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioWideStruct } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioWideStruct>();
