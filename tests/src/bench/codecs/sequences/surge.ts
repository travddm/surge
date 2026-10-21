//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Effects } from "./shapes";

export const serializer = createCodec<Effects>();
