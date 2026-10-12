//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Toggles } from "./shapes";

export const cursorUnpackedSerializer = createCursorCodec<Toggles>();
