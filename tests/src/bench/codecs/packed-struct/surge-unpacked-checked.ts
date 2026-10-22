//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { Toggles } from "./shapes";

export const checkedUnpackedSerializer = createCodec<Toggles>({ readChecks: true });
