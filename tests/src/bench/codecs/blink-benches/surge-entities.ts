//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Entities } from "./shapes";

export const entitiesSerializer = createCodec<Entities>();
