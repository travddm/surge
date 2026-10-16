//!native
//!optimize 2
import { createCursorCodec } from "@rbxts/surge";

import type { TreeNode } from "./shapes";

export const cursorSerializer = createCursorCodec<TreeNode>();
