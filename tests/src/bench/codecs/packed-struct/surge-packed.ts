//!native
//!optimize 2
import type { DataType } from "@rbxts/surge";
import { createCodec } from "@rbxts/surge";

import type { Toggles } from "./shapes";

export const packedSerializer = createCodec<DataType.Packed<Toggles>>();
