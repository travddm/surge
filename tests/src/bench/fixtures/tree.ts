//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { surgeAdapter } from "../adapters/surge";
import { tree as baselineCodec } from "../baseline/codecs";
import type { TreeNode } from "../codecs/tree/shapes";
import { serializer } from "../codecs/tree/surge";

const BRANCHING = 4;
const DEPTH = 3;

const rng = new Rng(5113);

function grow(depth: number): TreeNode {
	const children = new Array<TreeNode>();
	if (depth > 0) {
		for (const _ of $range(1, BRANCHING)) {
			children.push(grow(depth - 1));
		}
	}
	return { id: rng.int(0, 65535), children };
}

const value = grow(DEPTH);

export const tree: Fixture = {
	name: "tree",
	note: `85 nodes of a u16, ${BRANCHING} children each to a depth of ${DEPTH}, through a recursion helper`,
	entries: [
		defineEntry<TreeNode>("surge", value, surgeAdapter(serializer)),
		defineEntry("baseline", value, baselineAdapter(baselineCodec)),
	],
};
