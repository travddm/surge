//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Booleans } from "./shapes";

export const checkedBooleansSerializer = createCodec<Booleans>({ readChecks: true });
