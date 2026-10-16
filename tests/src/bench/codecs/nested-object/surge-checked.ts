//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { NestedObject } from "./shapes";

export const checkedSerializer = createCodec<NestedObject>({ readChecks: true });
