//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { LargeArray } from "./shapes";

export const serializer = createCodec<LargeArray>();
