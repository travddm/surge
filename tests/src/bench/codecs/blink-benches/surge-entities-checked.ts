//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Entities } from "./shapes";

export const checkedEntitiesSerializer = createCodec<Entities>({ readChecks: true });
