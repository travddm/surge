//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { WideStruct } from "./shapes";

export const serializer = createCodec<WideStruct>();
