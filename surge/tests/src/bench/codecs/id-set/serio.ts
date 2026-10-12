//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioIdSet } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioIdSet>();
