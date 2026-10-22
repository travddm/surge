//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { GuardedUnion } from "./shapes";

export const checkedSerializer = createCodec<GuardedUnion>({ readChecks: true });
