//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { LargeRecord } from "./shapes";

export const checkedSerializer = createCodec<LargeRecord>({ readChecks: true });
