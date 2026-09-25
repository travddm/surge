//!native
//!optimize 2
import { createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import { createCodec } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 100;

/**
 * `Enum.Material` has 45 members, so each item is a u8 index in all three
 * libraries -- surge indexes the members sorted by name, fbs and serio by
 * `.Value`, which is the same width. The wide (u16) index that an enum of
 * more than 256 members takes cannot be measured here: the generated lookup
 * tables name every member `@rbxts/types` declares, and Lune's Roblox
 * database is missing members of every such enum -- `KeyCode` included,
 * which is why `coverage.spec.ts` skips it too.
 *
 * No width brands, so the three libraries share one shape.
 */
interface EnumHeavy {
	materials: Enum.Material[];
	primary: Enum.Material;
	rig: Enum.HumanoidRigType;
}

const serializer = createCodec<EnumHeavy>();
const fbsSerializer = createFbsSerializer<EnumHeavy>();
const serioSerializer = createSerioSerializer<EnumHeavy>();

const rng = new Rng(6653);
const materials = Enum.Material.GetEnumItems();
const picked = new Array<Enum.Material>();
for (const _ of $range(1, COUNT)) {
	picked.push(rng.pick(materials));
}

const value: EnumHeavy = {
	materials: picked,
	primary: Enum.Material.Plastic,
	rig: Enum.HumanoidRigType.R15,
};

export const enumHeavy: Fixture = {
	name: "enum-heavy",
	note: `${COUNT} Enum.Material items plus two scalar enum fields, one index byte each`,
	entries: [
		defineEntry<EnumHeavy>("surge", value, surgeAdapter(serializer)),
		defineEntry<EnumHeavy>("fbs", value, fbsAdapter(fbsSerializer)),
		defineEntry<EnumHeavy>("serio", value, serioAdapter(serioSerializer)),
	],
};
