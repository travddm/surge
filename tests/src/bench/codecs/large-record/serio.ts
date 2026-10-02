//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioLargeRecord } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioLargeRecord>();
