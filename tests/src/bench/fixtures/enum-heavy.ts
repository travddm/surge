import { createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 100;

/**
 * `Enum.Material` has 45 members, so each item is a u8 index. The wide (u16)
 * index that an enum of more than 256 members takes cannot be measured here:
 * the generated lookup tables name every member `@rbxts/types` declares, and
 * Lune's Roblox database is missing members of every such enum -- `KeyCode`
 * included, which is why `coverage.spec.ts` skips it too.
 */
interface EnumHeavy {
	materials: Enum.Material[];
	primary: Enum.Material;
	rig: Enum.HumanoidRigType;
}

const serializer = createBinarySerializer<EnumHeavy>();

const rng = new Rng(6653);
const materials = Enum.Material.GetEnumItems();
const picked = new Array<Enum.Material>();
for (const _ of $range(1, COUNT)) {
	picked.push(rng.pick(materials));
}

export const enumHeavy = defineFixture<EnumHeavy>(
	"enum-heavy",
	`${COUNT} Enum.Material items plus two scalar enum fields, one index byte each`,
	{ materials: picked, primary: Enum.Material.Plastic, rig: Enum.HumanoidRigType.R15 },
	surgeAdapter(serializer),
);
