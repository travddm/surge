//!native
//!optimize 2
import type { DataType } from "@rbxts/surge";
import { createCodec } from "@rbxts/surge";

import type { Transforms } from "./shapes";

export const checkedPackedSerializer = createCodec<DataType.Packed<Transforms>>({ readChecks: true });
