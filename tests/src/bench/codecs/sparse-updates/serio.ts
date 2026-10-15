//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioUpdates } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioUpdates>();
