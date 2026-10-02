//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioEntities } from "./shapes";

export const serioEntitiesSerializer = createSerioSerializer<SerioEntities>();
