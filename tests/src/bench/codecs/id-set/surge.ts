//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { IdSet } from "./shapes";

export const serializer = createCodec<IdSet>();
