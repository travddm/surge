//!native
//!optimize 2
import type { DataType } from "@rbxts/surge";
import { createCodec } from "@rbxts/surge";

import type { Transforms } from "./shapes";

export const packedSerializer = createCodec<DataType.Packed<Transforms>>();
