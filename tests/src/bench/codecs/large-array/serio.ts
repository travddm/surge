//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioLargeArray } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioLargeArray>();
