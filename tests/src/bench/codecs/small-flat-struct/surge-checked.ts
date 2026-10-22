//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { SmallFlatStruct } from "./shapes";

export const checkedSerializer = createCodec<SmallFlatStruct>({ readChecks: true });
