//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Transforms } from "./shapes";

export const serializer = createCodec<Transforms>();
