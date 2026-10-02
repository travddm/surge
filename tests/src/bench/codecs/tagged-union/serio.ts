//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { SerioTaggedUnion } from "./shapes";

export const serioSerializer = createSerioSerializer<SerioTaggedUnion>();
