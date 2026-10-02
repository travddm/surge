//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioNestedObject } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioNestedObject>();
