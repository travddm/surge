//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { cursorAdapter } from "../adapters/surge-cursor";
import { zapAdapter } from "../adapters/zap";
import { fbsSerializer } from "../codecs/id-set/fbs";
import { flamework2Serializer } from "../codecs/id-set/flamework2";
import { serioSerializer } from "../codecs/id-set/serio";
import type { FbsIdSet, IdSet, SerioIdSet } from "../codecs/id-set/shapes";
import { serializer } from "../codecs/id-set/surge";
import { checkedSerializer } from "../codecs/id-set/surge-checked";
import { cursorSerializer } from "../codecs/id-set/surge-cursor";

const COUNT = 200;

const rng = new Rng(1021);
const ids = new Set<number>();
while (ids.size() < COUNT) {
	ids.add(rng.int(0, 65535));
}

export const idSet: Fixture = {
	name: "set",
	note: `${COUNT} u16 ids in a Set`,
	entries: [
		defineEntry<IdSet>("surge", { ids }, surgeAdapter(serializer)),
		defineEntry<IdSet>("surge (cursor)", { ids }, cursorAdapter(cursorSerializer)),
		defineEntry<IdSet>("surge (readChecks)", { ids }, surgeAdapter(checkedSerializer)),
		defineEntry<FbsIdSet>("fbs", { ids }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioIdSet>("serio", { ids }, serioAdapter(serioSerializer)),
		defineEntry<IdSet>("flamework2", { ids }, flamework2Adapter(flamework2Serializer)),
		defineEntry(
			"zap",
			{ ids },
			zapAdapter((zap) => zap.Ids),
		),
	],
};
