//!native
//!optimize 2
import type { DataType } from "@rbxts/surge";
import { createCursorCodec } from "@rbxts/surge";

import type { Transforms } from "./shapes";

export const cursorPackedSerializer = createCursorCodec<DataType.Packed<Transforms>>();
