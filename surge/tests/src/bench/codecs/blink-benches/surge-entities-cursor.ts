//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Entities } from "./shapes";

export const cursorEntitiesSerializer = createCursorCodec<Entities>();
