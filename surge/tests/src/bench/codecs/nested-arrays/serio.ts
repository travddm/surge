//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioNestedArrays } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioNestedArrays>();
