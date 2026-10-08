//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { Transforms } from "./shapes";

export const serioSerializer = createSerioSerializer<Transforms>();
