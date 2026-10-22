//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { NestedArrays } from "./shapes";

export const checkedSerializer = createCodec<NestedArrays>({ readChecks: true });
