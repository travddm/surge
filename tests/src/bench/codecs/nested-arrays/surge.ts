//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { NestedArrays } from "./shapes";

export const serializer = createCodec<NestedArrays>();
