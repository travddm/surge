//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { EnumHeavy } from "./shapes";

export const serializer = createCodec<EnumHeavy>();
