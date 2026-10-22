//!native
//!optimize 2
import createSerioSerializer from "@rbxts/serio";

import type { Layout } from "./shapes";

export const serioSerializer = createSerioSerializer<Layout>();
