import { DataType, createBinarySerializer } from "@rbxts/surge";

import { Rng } from "../../support";
import { defineFixture } from "../adapter";
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

const serializer = createBinarySerializer<TaggedUnion>();

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

export const taggedUnion = defineFixture<TaggedUnion>(
	"tagged union",
	`${COUNT} events over four variants, discriminated by a literal field`,
	{ events },
	surgeAdapter(serializer),
);
