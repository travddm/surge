//!native
//!optimize 2
import { Flamework, Serialization } from "@flamework-experimental/core";

interface TreeNode {
	id: Serialization.u16;
	children: TreeNode[];
}

export const flamework2Serializer = Flamework.createSerializer<TreeNode>();
