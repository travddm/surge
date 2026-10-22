//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { QuantizedTransforms } from "./shapes";

export const cursorQuantizedSerializer = createCursorCodec<QuantizedTransforms>();
