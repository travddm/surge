//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { Booleans } from "./shapes";

export const serioBooleansSerializer = createSerioSerializer<Booleans>();
