//!native
//!optimize 2
import { createCodec } from "@rbxts/surge";

import type { TreeNode } from "./shapes";

export const serializer = createCodec<TreeNode>();
