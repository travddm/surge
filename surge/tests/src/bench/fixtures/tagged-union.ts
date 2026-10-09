//!native
//!optimize 2
import type { DataType } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { baselineAdapter } from "../adapters/baseline";
import { blinkAdapter } from "../adapters/blink";
import { fbsAdapter } from "../adapters/fbs";
import { flamework2Adapter } from "../adapters/flamework2";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";
import { zapAdapter } from "../adapters/zap";
import { taggedUnion as baselineCodec } from "../baseline/codecs";
import { TaggedUnion as blinkCodec } from "../blink/server";
import { fbsSerializer } from "../codecs/tagged-union/fbs";
import { flamework2Serializer } from "../codecs/tagged-union/flamework2";
import { serioSerializer } from "../codecs/tagged-union/serio";
import type { Event, FbsTaggedUnion, SerioTaggedUnion, TaggedUnion } from "../codecs/tagged-union/shapes";
import { serializer } from "../codecs/tagged-union/surge";

const COUNT = 100;

const rng = new Rng(8081);
const events = new Array<Event>();
for (const index of $range(1, COUNT)) {
	const id = index;
	const variant = rng.int(0, 3);
	if (variant === 0) {
		events.push({ kind: "spawn", id, at: new Vector3(rng.f32(), rng.f32(), rng.f32()) });
	} else if (variant === 1) {
		events.push({ kind: "damage", id, amount: rng.int(0, 65535) });
	} else if (variant === 2) {
		events.push({ kind: "chat", id, text: rng.str(24) });
	} else {
		events.push({ kind: "despawn", id });
	}
}

/**
 * Zap's generated writer reads a vector's components as `.x`, which Roblox's
 * `Vector3` aliases and Lune's does not, and its decoder hands back Luau's
 * native `vector`. So its entry carries the same events with native vectors:
 * the same three f32 on the wire, and the form both halves of that library
 * see in a real engine too.
 */
type ZapEvent =
	| { kind: "spawn"; id: DataType.u32; at: vector }
	| { kind: "damage"; id: DataType.u32; amount: DataType.u16 }
	| { kind: "chat"; id: DataType.u32; text: string }
	| { kind: "despawn"; id: DataType.u32 };

const zapEvents = events.map<ZapEvent>((event) =>
	event.kind === "spawn"
		? { kind: "spawn", id: event.id, at: vector.create(event.at.X, event.at.Y, event.at.Z) }
		: event,
);

export const taggedUnion: Fixture = {
	name: "tagged union",
	note: `${COUNT} events over four variants, discriminated by a literal field`,
	entries: [
		defineEntry<TaggedUnion>("surge", { events }, surgeAdapter(serializer)),
		defineEntry<FbsTaggedUnion>("fbs", { events }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioTaggedUnion>("serio", { events }, serioAdapter(serioSerializer)),
		defineEntry<TaggedUnion>("flamework2", { events }, flamework2Adapter(flamework2Serializer)),
		defineEntry("blink", { events }, blinkAdapter(blinkCodec)),
		defineEntry(
			"zap",
			{ events: zapEvents },
			zapAdapter((zap) => zap.Tagged),
		),
		defineEntry("baseline", { events }, baselineAdapter(baselineCodec)),
	],
};
