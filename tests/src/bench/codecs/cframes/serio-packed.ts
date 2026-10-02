//!native
//!optimize 2
import type * as Serio from "@rbxts/serio";
import createSerioSerializer from "@rbxts/serio";

import type { Transforms } from "./shapes";

export const serioPackedSerializer = createSerioSerializer<Serio.Packed<Transforms>>();
