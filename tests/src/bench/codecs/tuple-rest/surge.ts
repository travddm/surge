//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Readings } from "./shapes";

export const serializer = createCodec<Readings>();
