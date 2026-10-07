//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Samples } from "./shapes";

export const serializer = createCodec<Samples>();
