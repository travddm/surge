//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { InstanceRefs } from "./shapes";

export const serializer = createCodec<InstanceRefs>();
