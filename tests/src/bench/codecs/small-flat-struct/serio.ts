//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioSmallFlatStruct } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioSmallFlatStruct>();
