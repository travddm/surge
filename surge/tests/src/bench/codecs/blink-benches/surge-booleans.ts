//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Booleans } from "./shapes";

export const booleansSerializer = createCodec<Booleans>();
