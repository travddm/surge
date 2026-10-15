//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Booleans } from "./shapes";

export const cursorBooleansSerializer = createCursorCodec<Booleans>();
