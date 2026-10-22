//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { Layout } from "./shapes";

export const cursorSerializer = createCursorCodec<Layout>();
