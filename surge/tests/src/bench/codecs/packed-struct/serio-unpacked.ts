//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioToggles } from "./shapes";

export const serioUnpackedSerializer = createSerioSerializer<SerioToggles>();
