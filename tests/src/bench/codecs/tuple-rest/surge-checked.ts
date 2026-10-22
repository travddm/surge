//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Readings } from "./shapes";

export const checkedSerializer = createCodec<Readings>({ readChecks: true });
