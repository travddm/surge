//!native
//!optimize 2
import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { cursorAdapter } from "../adapters/surge-cursor";
import { zapAdapter } from "../adapters/zap";
import { SparseUpdates as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/sparse-updates/fbs";
import { flamework2Serializer } from "../codecs/sparse-updates/flamework2";
import { serioSerializer } from "../codecs/sparse-updates/serio";
import type { FbsUpdates, SerioUpdates, State, Update, Updates } from "../codecs/sparse-updates/shapes";
import { serializer } from "../codecs/sparse-updates/surge";
import { checkedSerializer } from "../codecs/sparse-updates/surge-checked";
import { cursorSerializer } from "../codecs/sparse-updates/surge-cursor";

const COUNT = 100;
const STATES: ReadonlyArray<State> = ["idle", "walking", "running", "dead"];

const rng = new Rng(8317);
const updates = new Array<Update>();
for (const _ of $range(1, COUNT)) {
	// Each optional is present half the time.
	updates.push({
		id: rng.int(0, 65535),
		health: rng.bool() ? rng.int(0, 65535) : undefined,
		name: rng.bool() ? rng.str(16) : undefined,
		position: rng.bool() ? new Vector3(rng.f32(), rng.f32(), rng.f32()) : undefined,
		state: rng.bool() ? rng.pick(STATES) : undefined,
	});
}

/**
 * Zap reads a vector's components as `.x`, which Lune's `Vector3` does not
 * alias, and decodes Luau's native `vector`, so its entry carries the same
 * updates with native vectors, as the tagged union's does.
 */
const zapUpdates = updates.map((update) => ({
	...update,
	position:
		update.position === undefined
			? undefined
			: vector.create(update.position.X, update.position.Y, update.position.Z),
}));

export const sparseUpdates: Fixture = {
	name: "sparse updates",
	note: `${COUNT} updates of a u16 id and four optionals, each present half the time`,
	entries: [
		defineEntry<Updates>("surge", { updates }, surgeAdapter(serializer)),
		defineEntry<Updates>("surge (cursor)", { updates }, cursorAdapter(cursorSerializer)),
		defineEntry<Updates>("surge (readChecks)", { updates }, surgeAdapter(checkedSerializer)),
		defineEntry<FbsUpdates>("fbs", { updates }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioUpdates>("serio", { updates }, serioAdapter(serioSerializer)),
		defineEntry<Updates>("flamework2", { updates }, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", { updates }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ updates: zapUpdates },
			zapAdapter((zap) => zap.Updates),
		),
	],
};
