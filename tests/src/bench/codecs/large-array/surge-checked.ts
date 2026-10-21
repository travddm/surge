//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { LargeArray } from "./shapes";

export const checkedSerializer = createCodec<LargeArray>({ readChecks: true });
