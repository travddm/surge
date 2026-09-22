import { DataType as Fbs, createBinarySerializer as createFbsSerializer } from "@rbxts/flamework-binary-serializer";
import createSerioSerializer from "@rbxts/serio";
import type * as Serio from "@rbxts/serio";
import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import type { Fixture } from "../adapter";
import { defineEntry } from "../adapter";
import { fbsAdapter } from "../adapters/fbs";
import { serioAdapter } from "../adapters/serio";
import { surgeAdapter } from "../adapters/surge";

const COUNT = 100;

type Event =
	| { kind: "spawn"; id: DataType.u32; at: Vector3 }
	| { kind: "damage"; id: DataType.u32; amount: DataType.u16 }
	| { kind: "chat"; id: DataType.u32; text: string }
	| { kind: "despawn"; id: DataType.u32 };

interface TaggedUnion {
	events: Event[];
}

type FbsEvent =
	| { kind: "spawn"; id: Fbs.u32; at: Vector3 }
	| { kind: "damage"; id: Fbs.u32; amount: Fbs.u16 }
	| { kind: "chat"; id: Fbs.u32; text: string }
	| { kind: "despawn"; id: Fbs.u32 };

interface FbsTaggedUnion {
	events: FbsEvent[];
}

type SerioEvent =
	| { kind: "spawn"; id: Serio.u32; at: Vector3 }
	| { kind: "damage"; id: Serio.u32; amount: Serio.u16 }
	| { kind: "chat"; id: Serio.u32; text: string }
	| { kind: "despawn"; id: Serio.u32 };

interface SerioTaggedUnion {
	events: SerioEvent[];
}

const serializer = createBinarySerializer<TaggedUnion>();
const fbsSerializer = createFbsSerializer<FbsTaggedUnion>();
const serioSerializer = createSerioSerializer<SerioTaggedUnion>();

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

export const taggedUnion: Fixture = {
	name: "tagged union",
	note: `${COUNT} events over four variants, discriminated by a literal field`,
	entries: [
		defineEntry<TaggedUnion>("surge", { events }, surgeAdapter(serializer)),
		defineEntry<FbsTaggedUnion>("fbs", { events }, fbsAdapter(fbsSerializer)),
		defineEntry<SerioTaggedUnion>("serio", { events }, serioAdapter(serioSerializer)),
	],
};
