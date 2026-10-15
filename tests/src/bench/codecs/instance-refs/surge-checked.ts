//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { InstanceRefs } from "./shapes";

export const checkedSerializer = createCodec<InstanceRefs>({ readChecks: true });
