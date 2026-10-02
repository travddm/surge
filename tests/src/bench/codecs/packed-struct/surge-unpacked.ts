//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Toggles } from "./shapes";

export const unpackedSerializer = createCodec<Toggles>();
