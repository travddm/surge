//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { StringHeavy } from "./shapes";

export const serializer = createCodec<StringHeavy>();
