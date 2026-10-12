//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { QuantizedTransforms } from "./shapes";

export const quantizedSerializer = createCodec<QuantizedTransforms>();
