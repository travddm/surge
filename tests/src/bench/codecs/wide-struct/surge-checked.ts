//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { WideStruct } from "./shapes";

export const checkedSerializer = createCodec<WideStruct>({ readChecks: true });
