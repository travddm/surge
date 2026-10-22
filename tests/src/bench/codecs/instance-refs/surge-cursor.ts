//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { InstanceRefs } from "./shapes";

export const cursorSerializer = createCursorCodec<InstanceRefs>();
