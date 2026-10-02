//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { fbsSerializer } from "../codecs/guarded-union/fbs";
import { serioSerializer } from "../codecs/guarded-union/serio";
import type { GuardedUnion, SerioGuardedUnion } from "../codecs/guarded-union/shapes";
import { serializer } from "../codecs/guarded-union/surge";

const COUNT = 100;

const rng = new Rng(3301);
const values = new Array<string | number | boolean>();
for (const _ of $range(1, COUNT)) {
	const variant = rng.int(0, 2);
	if (variant === 0) {
		values.push(rng.str(16));
	} else if (variant === 1) {
		values.push(rng.f64());
	} else {
		values.push(rng.bool());
	}
}

export const guardedUnion: Fixture = {
	name: "guarded union",
	note: `${COUNT} values over string, number, and boolean`,
	entries: [
		defineEntry<GuardedUnion>("surge", { values }, surgeAdapter(serializer)),
		defineEntry<GuardedUnion>("fbs", { values }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioGuardedUnion>("serio", { values }, serioAdapter(serioSerializer)),
		defineEntry(
			"zap",
			{ values },
			zapAdapter((zap) => zap.Guarded),
		),
	],
};
