//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { StringHeavy } from "./shapes";

export const serioSerializer = createSerioSerializer<StringHeavy>();
