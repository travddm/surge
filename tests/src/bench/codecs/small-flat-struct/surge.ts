//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { SmallFlatStruct } from "./shapes";

export const serializer = createCodec<SmallFlatStruct>();
