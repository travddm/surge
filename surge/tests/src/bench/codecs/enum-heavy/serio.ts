//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { EnumHeavy } from "./shapes";

export const serioSerializer = createSerioSerializer<EnumHeavy>();
