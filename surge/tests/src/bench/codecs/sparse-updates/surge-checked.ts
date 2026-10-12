//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Updates } from "./shapes";

export const checkedSerializer = createCodec<Updates>({ readChecks: true });
