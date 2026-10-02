//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { fbsSerializer } from "../codecs/enum-heavy/fbs";
import { serioSerializer } from "../codecs/enum-heavy/serio";
import type { EnumHeavy } from "../codecs/enum-heavy/shapes";
import { serializer } from "../codecs/enum-heavy/surge";

const COUNT = 100;

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
