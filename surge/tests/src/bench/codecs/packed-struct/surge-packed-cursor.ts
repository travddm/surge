//!native
//!optimize 2
import type { DataType } from "@rbxts/surge";
import { createCursorCodec } from "@rbxts/surge";

import type { Toggles } from "./shapes";

export const cursorPackedSerializer = createCursorCodec<DataType.Packed<Toggles>>();
